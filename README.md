# Enhanced_RRSIS_UOT: Enhanced Referring Remote Sensing Image Segmentation with Unbalanced Optimal Transport

**Enhanced_RRSIS_UOT** extends **RRSIS_SAM3** with **4+1 novel techniques** for improved performance on referring remote sensing image segmentation, targeting **82–83% mIoU** on RRSIS-D.

---

## What's New (Over RRSIS_SAM3)

| Enhancement | Module | Description |
|-------------|--------|-------------|
| 🟢 **Text-Guided Dynamic LoRA** | [dynamic_lora.py](file:///d:/FYPPP/ahmadnoidea/lib/dynamic_lora.py) | Text-conditioned vision adapter weights — vision encoder adapts per-caption |
| 🟢 **Multi-Scale OT Alignment** | [multiscale_ot_alignment.py](file:///d:/FYPPP/ahmadnoidea/lib/multiscale_ot_alignment.py) | Scale-aware OT alignment across all FPN levels with gated residual fusion |
| 🟢 **OHEM + Focal + Boundary Loss** | [ohem_loss.py](file:///d:/FYPPP/ahmadnoidea/lib/ohem_loss.py) | Hard pixel mining + focal weighting + boundary-aware supervision |
| 🟢 **Contrastive Loss (InfoNCE)** | [contrastive_loss.py](file:///d:/FYPPP/ahmadnoidea/lib/contrastive_loss.py) | Auxiliary loss aligning masked visual features with text features |
| 🟢 **Grounding-Aware Prompt Generator** | [prompt_generator.py](file:///d:/FYPPP/ahmadnoidea/lib/prompt_generator.py) | Extracts point-based geometric prompts from OT transport plans |
| 🟢 **Scale-Aware Prompting (SAP)** | [prompt_generator.py](file:///d:/FYPPP/ahmadnoidea/lib/prompt_generator.py) | Dynamically adapts point counts based on object scale to suppress noise |

---

## Architecture

![Enhanced RRSIS-UOT Architecture](Final_RRSIS_Architecture.jpeg)

### System Architecture Flow (Mermaid Diagram)

```mermaid
graph TD
    classDef input fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#fff
    classDef encoder fill:#2b6cb0,stroke:#2c5282,stroke-width:2px,color:#fff
    classDef alignment fill:#805ad5,stroke:#553c9a,stroke-width:2px,color:#fff
    classDef prompt fill:#38a169,stroke:#22543d,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
    classDef fusion fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff
    classDef decoder fill:#c53030,stroke:#742a2a,stroke-width:2px,color:#fff
    classDef output fill:#d69e2e,stroke:#975a16,stroke-width:2px,color:#fff

    subgraph Inputs
        I["Image (B,3,504,504)"]:::input
        C["Text Caption (List str)"]:::input
    end

    subgraph Feature_Extraction
        VE["Text Encoder<br/>(seq,B,256)"]:::encoder
        LoRA["Dynamic LoRA Manager<br/>pooled text → scale vectors"]:::encoder
        ViT["SAM3 ViT Backbone + FPN<br/>List (B,256,H_i,W_i)"]:::encoder
    end

    subgraph Cross_Modal_Alignment
        OT["MultiScale OT Aligner<br/>FP32-safe Sinkhorn"]:::alignment
        OT_Map["Transport Plan P<br/>(B, HW, seq)"]:::alignment
        SCL["SCL Loss<br/>MSE(P^T·S_img·P, S_txt)"]:::alignment
        Enh_Vis["OT-Enhanced FPN Features"]:::alignment
    end

    subgraph Grounding_Aware_Prompts
        GPG["GPG Prompt Generator"]:::prompt
        SAP["Scale-Aware Prompting<br/>tiny → 1pt, large → 5pts"]:::prompt
        Pts["Sparse Points (B,K,2)"]:::prompt
    end
    
    subgraph SAM3_Core
        PE["Geometry Encoder"]:::prompt
        TransEnc["Transformer Encoder<br/>Fusion: Vision + Text + Prompts"]:::fusion
        TransDec["Transformer Decoder<br/>N=3 Query Hypotheses"]:::decoder
    end

    subgraph Output_and_Loss
        SegHead["Segmentation Head<br/>pred_masks (B,N,H,W)"]:::decoder
        Select["Best Mask Selection<br/>IoU-based Score Ranking"]:::output
        Mask["Final Mask (B,1,504,504)"]:::output
        Loss["OHEM + FocalDice + Boundary<br/>+ 0.1×Contrastive + 0.1×SCL"]:::output
    end

    I --> ViT
    C --> VE
    
    VE --> LoRA
    LoRA -.->|"Text-Conditioned Weights"| ViT
    
    VE --> OT
    ViT --> OT
    OT --> OT_Map
    OT --> Enh_Vis
    OT --> SCL
    
    OT_Map --> GPG
    GPG --> SAP
    SAP --> Pts
    
    Pts ==>|"Inject Points"| PE
    PE --> TransEnc
    
    Enh_Vis ==> TransEnc
    VE ==> TransEnc
    
    TransEnc ==>|"Encoder Hidden States"| TransDec
    TransDec --> SegHead
    SegHead --> Select
    Select --> Mask
    Mask --> Loss
    SCL --> Loss
```

### Data Flow Summary

```
Image (B,3,504,504) + Caption (List[str])
  ├─ Step 0:   Normalize → [-1, 1]
  ├─ Step 1:   Text Encoder → language_features (seq, B, 256)
  ├─ Step 1.5: Dynamic LoRA → cache pooled text (B, 256) in all LoRA layers
  ├─ Step 1.8: ViT + LoRA → backbone_fpn: List[(B, 256, H_i, W_i)]
  ├─ Step 2:   Multi-Scale OT → aligned FPN + transport plan P (B, HW, seq)
  ├─ Step 3:   GPG + SAP → sparse points (B, K, 2)
  ├─ Step 4:   Encode Prompt → prompt tokens
  ├─ Step 5:   Transformer Encoder → fused hidden states
  ├─ Step 6:   DETR Decoder → N=3 mask hypotheses
  ├─ Step 7:   Segmentation Head → pred_masks (B, N, H, W)
  ├─ Step 8:   Best Mask Selection → (B, 1, 504, 504)  [IoU-based ranking]
  └─ Step 10:  Loss = SegLoss + 0.1 × Contrastive + 0.1 × SCL
```

---

## Key Differences from RRSIS_SAM3

| Feature | RRSIS_SAM3 | Enhanced_RRSIS_UOT |
|---------|------------|---------------------|
| LoRA Type | Static (same weights for all inputs) | **Dynamic** (text-conditioned per-caption) |
| OT Alignment | Single-scale, one pass | **Multi-scale** across all FPN levels |
| OT Numerics | FP16 (NaN risk) | **FP32-safe Sinkhorn** with autocast disabled |
| Loss Function | Dice + BCE | **OHEM + FocalDice + Boundary + Contrastive + SCL** |
| Score Supervision | Uniform 1/N targets | **IoU-based query matching** (best query → 1.0, others → 0.0) |
| Contrastive Features | Pooled encoder output (no spatial info) | **FPN features** with real spatial structure |
| Vision-Language Bond | Fusion encoder only | **Early** (LoRA) + **Mid** (OT) + **Late** (Contrastive) alignment |
| Point Grounding | None | **GPG with Scale-Aware Prompting (SAP)** |

---

## Bug Fixes Applied (v2)

These critical bugs from v1 have been fixed in this release:

| Bug | Severity | Fix |
|-----|----------|-----|
| **Sinkhorn FP16 underflow** → NaN crash | 🔴 Critical | Force FP32 + `autocast(enabled=False)` inside Sinkhorn |
| **Score supervision** → all queries trained to 1/N | 🟠 High | IoU-based matching: best query → 1.0, others → 0.0 |
| **Contrastive loss** → constant spatial map | 🟡 Medium | Use real FPN features instead of pooled+expanded |
| **SCL weight** → hardcoded 0.1 | 🟢 Low | Configurable `scl_weight` parameter |
| **Deprecated APIs** → PyTorch warnings | 🟢 Low | Updated `torch.amp.GradScaler` and `torch.amp.autocast` |

---

## Supported Datasets

| Dataset | Train | Val | Test | Image Size | Categories | Reference |
|---------|-------|-----|------|------------|------------|-----------|
| **RRSIS-D** | 12,181 | 1,740 | 3,481 | 800×800 | 20 | DIOR-RSVG |
| **RRSIS-HR** | 2,118 | 268 | 264 | 1024×1024 | 7 | High-Res |
| **RefSegRS** | 2,172 | 413 | 1,817 | 512×512 | — | Original RS |

---

## Project Structure

```
Enhanced_RRSIS_UOT/
├── sam3/                           # SAM3 core implementation
├── configs/
│   ├── enhanced_rrsis_uot.yaml     # Full configuration for enhanced model
│   └── rrsis_sam3.yaml             # Baseline configuration
├── data/
│   └── dataset.py                  # Dataloaders for RRSIS-D, RRSIS-HR, RefSegRS
├── refer/
│   └── refer.py                    # REFER API wrapper for dataset annotations
├── loss/
│   └── loss.py                     # Legacy loss functions (standard Dice + BCE)
├── lib/
│   ├── enhanced_model.py           # ★ Main model wrapper coordinating the enhancements
│   ├── dynamic_lora.py             # ★ Text-Guided Dynamic LoRA module
│   ├── contrastive_loss.py         # ★ InfoNCE Contrastive Loss module
│   ├── multiscale_ot_alignment.py  # ★ Multi-Scale OT Alignment with FP32-safe Sinkhorn
│   ├── ohem_loss.py                # ★ OHEM + Focal + Boundary Loss with IoU-based score ranking
│   ├── prompt_generator.py         # ★ GPG (Grounding-Aware Prompt Generator) + SAP
│   ├── decoder_ot_text.py          # ☆ OT-based text attention for decoder layers (Inactive/Experimental)
│   ├── rrsis_sam3_model.py         # Base model implementation (RRSIS_SAM3)
│   ├── rs_adapters.py              # Static LoRA adapter fallback
│   ├── ot_feature_alignment.py     # Single-scale OT fallback
│   └── ot_loss.py                  # Standard Dice+BCE loss fallback
├── args.py                         # CLI parameter definitions
├── train.py                        # Model training workflow
├── test.py                         # Model evaluation workflow
├── test_forward_pass.py            # Quick sanity test script to verify model forward pass
├── transforms.py                   # Target-aware augmentations and resize utilities
├── utils.py                        # Common training helper utilities
├── requirements.txt                # Project dependency packages
├── fine.sh                         # Optimized training shell script
└── test.sh                         # Evaluation shell script
```

---

## Training

### 🏆 Recommended Training Command (Best Performance)

Optimized hyperparameters for **RRSIS-D** (16GB+ VRAM):

```bash
env MPLBACKEND="agg" WANDB_MODE=disabled python train.py \
      --dataset rrsis_d \
      --data_root ./data/ \
      --sam3_ckpt ./pre-trained-weights/sam3.pt \
      --output_dir ./output/rrsis_d_enhanced_v2 \
      --image_size 504 \
      --lora_rank 16 \
      --lora_alpha 32.0 \
      --epochs 40 \
      --batch_size 2 \
      --grad_accum_steps 8 \
      --lr 5e-5 \
      --lr_backbone 1e-5 \
      --lr_decoder 5e-5 \
      --weight_decay 0.01 \
      --warmup_epochs 5 \
      --contrastive_weight 0.1 \
      --ohem_hard_ratio 0.3 \
      --ot_reg 0.1 \
      --ot_num_iter 10 \
      --num_ot_scales 3 \
      --boundary_loss_weight 0.5 \
      --focal_gamma 2.0 \
      --fp16 \
      --gradient_checkpointing \
      --seed 42 \
      --num_workers 4 \
      --use_dynamic_lora \
      --use_contrastive_loss \
      --use_multiscale_ot \
      --use_ohem_loss
```

Or run via the optimized launcher script:
```bash
bash fine.sh rrsis_d ./data ./pre-trained-weights/sam3.pt
```

### ⚡ Quick Training (Ablation / Dev Run)

```bash
env MPLBACKEND="agg" python train.py \
      --dataset rrsis_d \
      --data_root ./data/ \
      --sam3_ckpt ./pre-trained-weights/sam3.pt \
      --output_dir ./output/quick_run \
      --epochs 25 \
      --batch_size 2 \
      --grad_accum_steps 4 \
      --lr 5e-5 \
      --ohem_hard_ratio 0.25 \
      --fp16 \
      --gradient_checkpointing
```

### 🔬 Ablation Studies

Toggle individual enhancements using the override flags:

```bash
# Baseline (equivalent to RRSIS_SAM3):
python train.py --dataset rrsis_d --data_root ./data/ --sam3_ckpt ./pre-trained-weights/sam3.pt \
    --no_dynamic_lora --no_contrastive_loss --no_multiscale_ot --no_ohem_loss

# Only Dynamic LoRA:
python train.py --dataset rrsis_d --data_root ./data/ --sam3_ckpt ./pre-trained-weights/sam3.pt \
    --no_contrastive_loss --no_multiscale_ot --no_ohem_loss

# Only OHEM Loss:
python train.py --dataset rrsis_d --data_root ./data/ --sam3_ckpt ./pre-trained-weights/sam3.pt \
    --no_dynamic_lora --no_contrastive_loss --no_multiscale_ot
```

---

## Evaluation

### Full Evaluation on Test Set

```bash
python test.py \
      --dataset rrsis_d \
      --data_root ./data/ \
      --sam3_ckpt ./pre-trained-weights/sam3.pt \
      --split test \
      --resume ./output/rrsis_d_enhanced_v2/best_model.pth \
      --fp16
```

Or run via the evaluation script:
```bash
bash test.sh rrsis_d test ./output/rrsis_d_enhanced_uot/best_model.pth
```

### Evaluation with Visualization (saves predicted masks)

```bash
python test.py \
      --dataset rrsis_d \
      --split test \
      --resume ./output/best_model.pth \
      --visualize \
      --fp16
```

### Expected Output Format

```
============================================================
  Results on rrsis_d (test)
============================================================
  mIoU:  82.35%
  oIoU:  83.12%
  P@0.5: 91.23%
  P@0.6: 87.45%
  P@0.7: 82.10%
  P@0.8: 72.34%
  P@0.9: 45.67%
  Samples: 3481
  Avg Time: 45.2ms
============================================================
```

---

## All CLI Arguments Reference

| Category | Argument | Default | Type | Description |
|----------|----------|---------|------|-------------|
| **Paths** | `--data_root` | `./data/` | str | Root directory of datasets |
| | `--output_dir` | `./output/` | str | Output directory for checkpoints |
| | `--sam3_ckpt` | `./pre-trained-weights/sam3.pt` | str | SAM3 pretrained checkpoint |
| | `--resume` | `` | str | Resume from checkpoint |
| **Dataset** | `--dataset` | `refcoco` | str | Dataset: `rrsis_d`, `rrsis_hr`, `refsegrs` |
| | `--split` | `train` | str | Data split |
| | `--max_tokens` | `32` | int | Max text token length |
| **Model** | `--image_size` | `504` | int | Input size (divisible by 14) |
| | `--lora_rank` | `16` | int | LoRA rank |
| | `--lora_alpha` | `32.0` | float | LoRA alpha scaling |
| **Enhancements** | `--use_dynamic_lora` | `True` | flag | Enable Dynamic LoRA |
| | `--use_contrastive_loss` | `True` | flag | Enable InfoNCE loss |
| | `--use_multiscale_ot` | `True` | flag | Enable Multi-Scale OT |
| | `--use_ohem_loss` | `True` | flag | Enable OHEM loss |
| | `--no_dynamic_lora` | `False` | flag | Disable Dynamic LoRA |
| | `--no_contrastive_loss` | `False` | flag | Disable contrastive loss |
| | `--no_multiscale_ot` | `False` | flag | Disable multi-scale OT |
| | `--no_ohem_loss` | `False` | flag | Disable OHEM loss |
| **Enhancement Params** | `--contrastive_weight` | `0.1` | float | InfoNCE loss weight |
| | `--ohem_hard_ratio` | `0.3` | float | OHEM hard pixel fraction |
| | `--ot_reg` | `0.1` | float | Sinkhorn regularization |
| | `--ot_num_iter` | `10` | int | Sinkhorn iterations |
| | `--num_ot_scales` | `3` | int | FPN scales for OT |
| | `--boundary_loss_weight` | `0.5` | float | Boundary loss weight |
| | `--focal_gamma` | `2.0` | float | Focal loss gamma |
| **Training** | `--epochs` | `40` | int | Training epochs |
| | `--batch_size` | `2` | int | Batch size per GPU |
| | `--lr` | `5e-5` | float | Base learning rate |
| | `--lr_backbone` | `1e-5` | float | Backbone (LoRA) LR |
| | `--lr_decoder` | `5e-5` | float | Decoder/seg head LR |
| | `--weight_decay` | `1e-2` | float | AdamW weight decay |
| | `--warmup_epochs` | `5` | int | LR warmup epochs |
| | `--grad_accum_steps` | `4` | int | Gradient accumulation |
| **Optimization** | `--fp16` | `True` | flag | Mixed precision (FP16) |
| | `--gradient_checkpointing` | `True` | flag | Gradient checkpointing |
| | `--seed` | `42` | int | Random seed |
| **Evaluation** | `--eval_only` | `False` | flag | Evaluation mode only |
| | `--visualize` | `False` | flag | Save prediction visualizations |

---

## Citation

```bibtex
@article{enhanced_rrsis_uot_2026,
    title={Enhanced RRSIS-UOT: Enhanced Referring Remote Sensing Image Segmentation with Unbalanced Optimal Transport},
    year={2026}
}
```
