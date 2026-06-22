"""
OT-Based Text Cross-Attention for DETR Decoder Layers.

Replaces the standard `ca_text` (nn.MultiheadAttention) in each SAM3 decoder
layer with an Optimal Transport-based text alignment module.

Instead of standard multi-head attention (where queries softmax-attend to text
tokens), OT computes a *structured* transport plan P that:
    1. Enforces mass conservation — every query gets text signal
    2. Distributes text tokens globally — no text token is ignored
    3. Learns cost-aware alignment — geometrically principled matching

Architecture per call:
    query (N_q, B, C) + text (seq, B, C) + mask (B, seq)
      → Project to alignment space
      → Cost matrix via cosine distance: (B, N_q, seq)
      → Sinkhorn OT → transport plan P: (B, N_q, seq)
      → Transport text to queries: aligned = (P * N_q) @ text
      → Gated fusion: gate * ot_output + (1-gate) * lightweight_attn
      → Output projection + LayerNorm
    Output: (result, None)  — same signature as nn.MultiheadAttention

Reference:
    De Plaen et al., "Unbalanced Optimal Transport: A Unified Framework
    for Object Detection", CVPR 2023.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class OTTextCrossAttention(nn.Module):
    """
    Drop-in replacement for nn.MultiheadAttention that uses Sinkhorn OT
    for query-to-text alignment in DETR decoder layers.

    Designed to match the call signature of nn.MultiheadAttention so the
    existing decoder forward code works without modification:
        output, _ = self.ca_text(query, key, value, key_padding_mask=mask)

    Args:
        d_model: Hidden dimension (256 for SAM3).
        n_heads: Number of attention heads (used for lightweight fallback attn).
        reg: Sinkhorn entropy regularization.
        num_iter: Number of Sinkhorn iterations.
        dropout: Dropout rate.
    """

    def __init__(self, d_model=256, n_heads=8, reg=0.1, num_iter=10, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.reg = reg
        self.num_iter = num_iter

        # Scale-specific projection heads for OT cost computation
        self.query_proj = nn.Linear(d_model, d_model)
        self.key_proj = nn.Linear(d_model, d_model)

        # Output projection for OT-aligned features
        self.ot_output_proj = nn.Linear(d_model, d_model)

        # Lightweight standard attention as a fallback/blend branch
        # This helps training stability — early on the model uses mostly attention,
        # then the OT gate gradually opens as OT learns meaningful transport plans
        self.fallback_attn = nn.MultiheadAttention(
            d_model, n_heads, dropout=dropout, batch_first=False
        )

        # Learnable gating: how much to use OT vs standard attention
        # Initialized to sigmoid(−2) ≈ 0.12 — starts mostly using fallback attention
        self.gate_proj = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.GELU(),
            nn.Linear(d_model, 1),
        )
        nn.init.constant_(self.gate_proj[-1].bias, -2.0)

        # Initialize OT output projection near zero for smooth start
        nn.init.zeros_(self.ot_output_proj.weight)
        nn.init.zeros_(self.ot_output_proj.bias)

        # Layer norm for OT branch
        self.ot_norm = nn.LayerNorm(d_model)

    @torch.no_grad()
    def sinkhorn(self, cost_matrix):
        """
        Balanced Sinkhorn algorithm for optimal transport.
        Forced FP32 to prevent underflow.

        Args:
            cost_matrix: (B, N_q, seq) pairwise cost.

        Returns:
            Transport plan P of shape (B, N_q, seq).
        """
        orig_dtype = cost_matrix.dtype
        device_type = 'cuda' if cost_matrix.is_cuda else 'cpu'

        with torch.amp.autocast(device_type, enabled=False):
            cost_matrix = cost_matrix.float()
            B, N, M = cost_matrix.shape

            # Uniform marginals
            mu = torch.full((B, N), 1.0 / N, device=cost_matrix.device, dtype=torch.float32)
            nu = torch.full((B, M), 1.0 / M, device=cost_matrix.device, dtype=torch.float32)

            # Gibbs kernel
            K = torch.exp(-cost_matrix / self.reg)
            K = K.clamp(min=1e-8)

            u = torch.ones_like(mu)
            for _ in range(self.num_iter):
                v = nu / (torch.bmm(K.transpose(1, 2), u.unsqueeze(2)).squeeze(2) + 1e-8)
                v = torch.clamp(v, min=1e-6, max=1e6)
                u = mu / (torch.bmm(K, v.unsqueeze(2)).squeeze(2) + 1e-8)
                u = torch.clamp(u, min=1e-6, max=1e6)

            P = u.unsqueeze(2) * K * v.unsqueeze(1)
            # Normalize P to sum to 1.0 for numerical stability and correct scaling
            P = P / (P.sum(dim=(1, 2), keepdim=True) + 1e-8)
            P = torch.where(torch.isnan(P) | torch.isinf(P), torch.zeros_like(P), P)

        return P.to(orig_dtype)

    def forward(self, query, key, value, key_padding_mask=None, **kwargs):
        """
        OT-based text cross-attention.

        Matches nn.MultiheadAttention signature:
            Args:
                query: (N_q, B, C) — decoder object queries
                key:   (seq, B, C) — text features
                value: (seq, B, C) — text features (same as key)
                key_padding_mask: (B, seq) — True for padding positions

            Returns:
                (output, None) — output: (N_q, B, C), same as MHA
        """
        N_q, B, C = query.shape
        seq = key.shape[0]

        # ====== Branch 1: OT-based alignment ======
        # Reshape to batch-first: (B, N_q, C) and (B, seq, C)
        q_bf = query.permute(1, 0, 2)  # (B, N_q, C)
        k_bf = key.permute(1, 0, 2)    # (B, seq, C)
        v_bf = value.permute(1, 0, 2)  # (B, seq, C)

        # Mask padding tokens
        if key_padding_mask is not None:
            valid_mask = ~key_padding_mask  # True = valid
            k_bf = k_bf * valid_mask.unsqueeze(-1).float()
            v_bf = v_bf * valid_mask.unsqueeze(-1).float()

        # Project to alignment space
        q_proj = self.query_proj(q_bf)  # (B, N_q, C)
        k_proj = self.key_proj(k_bf)    # (B, seq, C)

        # Cost matrix via negative cosine similarity
        q_norm = F.normalize(q_proj, dim=-1)
        k_norm = F.normalize(k_proj, dim=-1)
        cost = 1.0 - torch.bmm(q_norm, k_norm.transpose(1, 2))  # (B, N_q, seq)

        # Compute OT transport plan
        P = self.sinkhorn(cost)  # (B, N_q, seq)

        # Transport text to query positions
        # Scale by N_q to match the marginal normalization (each row of P sums to 1/N_q)
        ot_aligned = torch.bmm(P * N_q, v_bf)  # (B, N_q, C)
        ot_aligned = self.ot_output_proj(ot_aligned)
        ot_aligned = self.ot_norm(ot_aligned)

        # ====== Branch 2: Lightweight standard attention ======
        attn_output, _ = self.fallback_attn(
            query, key, value, key_padding_mask=key_padding_mask
        )  # (N_q, B, C)
        attn_bf = attn_output.permute(1, 0, 2)  # (B, N_q, C)

        # ====== Gated Fusion ======
        gate_input = torch.cat([ot_aligned, attn_bf], dim=-1)  # (B, N_q, 2C)
        gate = torch.sigmoid(self.gate_proj(gate_input))  # (B, N_q, 1)

        fused = gate * ot_aligned + (1 - gate) * attn_bf  # (B, N_q, C)

        # Back to seq-first: (N_q, B, C)
        output = fused.permute(1, 0, 2)

        return output, None


def inject_decoder_ot(decoder, d_model=256, n_heads=8, reg=0.1, num_iter=10, dropout=0.1):
    """
    Inject OT-based text cross-attention into SAM3 DETR decoder layers.

    Replaces `ca_text` (nn.MultiheadAttention) in each TransformerDecoderLayer
    with OTTextCrossAttention. Preserves catext_dropout and catext_norm.

    Args:
        decoder: SAM3 TransformerDecoder instance.
        d_model: Hidden dimension (256).
        n_heads: Number of attention heads (8).
        reg: Sinkhorn regularization.
        num_iter: Sinkhorn iterations.
        dropout: Dropout rate.

    Returns:
        List of OTTextCrossAttention modules (for parameter group assignment).
    """
    ot_modules = []
    replaced = 0

    for layer_idx, layer in enumerate(decoder.layers):
        if hasattr(layer, 'use_text_cross_attention') and layer.use_text_cross_attention:
            # Create new OT module
            ot_text = OTTextCrossAttention(
                d_model=d_model,
                n_heads=n_heads,
                reg=reg,
                num_iter=num_iter,
                dropout=dropout,
            )

            # Move to same device as the original ca_text
            if hasattr(layer, 'ca_text'):
                device = next(layer.ca_text.parameters()).device
                ot_text = ot_text.to(device)

            # Replace ca_text
            layer.ca_text = ot_text
            ot_modules.append(ot_text)
            replaced += 1

            print(f"  [DecoderOT] Layer {layer_idx}: Replaced ca_text → OTTextCrossAttention")

    print(f"[DecoderOT] Replaced {replaced}/{len(decoder.layers)} decoder layers with OT text alignment")
    return ot_modules
