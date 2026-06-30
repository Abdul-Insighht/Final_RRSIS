"""
Simplified checkpoint loading without mmcv dependency
For inference only - loads Swin Transformer weights
"""
import torch
import torch.nn.functional as F
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


def load_checkpoint(model, filename, map_location='cpu', strict=False, logger=None):
    """
    Load checkpoint from a file.
    Simplified version without mmcv dependency.
    
    Args:
        model: PyTorch model
        filename: Path to checkpoint file
        map_location: Device to load to
        strict: Whether to strictly enforce key matching
        logger_obj: Logger for messages
        
    Returns:
        checkpoint dict
    """
    # Load checkpoint
    checkpoint = torch.load(filename, map_location=map_location, weights_only=False)
    
    # Extract state dict
    if 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
    elif 'model' in checkpoint:
        state_dict = checkpoint['model']
    else:
        state_dict = checkpoint
    
    # Strip module prefix if present
    if list(state_dict.keys())[0].startswith('module.'):
        state_dict = {k[7:]: v for k, v in state_dict.items()}
    
    # Strip backbone prefix if present (for Swin weights)
    if list(state_dict.keys())[0].startswith('backbone.'):
        logger.info('Stripping backbone prefix from Swin weights')
        state_dict = {k.replace('backbone.', ''): v for k, v in state_dict.items() 
                     if k.startswith('backbone.')}
    
    # Strip encoder prefix if present (for MoBY)
    if sorted(list(state_dict.keys()))[0].startswith('encoder'):
        state_dict = {k.replace('encoder.', ''): v for k, v in state_dict.items() 
                     if k.startswith('encoder.')}
    
    # Interpolate position bias tables if needed
    relative_position_bias_table_keys = [k for k in state_dict.keys() 
                                         if "relative_position_bias_table" in k]
    
    for table_key in relative_position_bias_table_keys:
        if table_key not in model.state_dict():
            continue
            
        table_pretrained = state_dict[table_key]
        table_current = model.state_dict()[table_key]
        L1, nH1 = table_pretrained.size()
        L2, nH2 = table_current.size()
        
        if nH1 != nH2:
            logger.warning(f"Skipping {table_key} - head mismatch")
            continue
            
        if L1 != L2:
            # Interpolate position bias table
            S1 = int(L1 ** 0.5)
            S2 = int(L2 ** 0.5)
            table_pretrained_resized = F.interpolate(
                table_pretrained.permute(1, 0).view(1, nH1, S1, S1),
                size=(S2, S2), 
                mode='bicubic'
            )
            state_dict[table_key] = table_pretrained_resized.view(nH2, L2).permute(1, 0)
            logger.info(f"Interpolated {table_key} from {L1} to {L2}")
    
    # Load state dict
    load_result = model.load_state_dict(state_dict, strict=strict)
    
    if load_result.missing_keys:
        logger.warning(f"Missing keys: {len(load_result.missing_keys)}")
        if logger:
            logger.warning(f"Missing keys: {load_result.missing_keys[:5]}")
    
    if load_result.unexpected_keys:
        logger.warning(f"Unexpected keys: {len(load_result.unexpected_keys)}")
    
    return checkpoint
