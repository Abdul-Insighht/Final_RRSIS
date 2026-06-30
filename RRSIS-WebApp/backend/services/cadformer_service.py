"""
CADFormer Inference Service
Real implementation with weight loading and inference pipeline
"""
import os
import sys
import base64
import logging
import numpy as np
from PIL import Image
from io import BytesIO
from argparse import Namespace

# Add cadformer module to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

# Optional heavy ML dependencies — server starts even if these are absent
NO_ML = False
try:
    import torch
    import torch.nn.functional as F
    from transformers import BertTokenizer
    from models.cadformer import lavt_one
except ImportError as _ml_err:
    NO_ML = True
    logging.warning(
        f"ML dependencies not available ({_ml_err}). "
        "The server will start but inference will be disabled. "
        "Run backend with: conda activate cadformer && python app.py"
    )


logger = logging.getLogger(__name__)

# Configuration
WEIGHTS_DIR = os.path.join(backend_dir, 'weights', 'cadformer')
CADFORMER_WEIGHTS = os.path.join(WEIGHTS_DIR, 'model_best_RMSIN.pth')
SWIN_WEIGHTS = os.path.join(WEIGHTS_DIR, 'swin_base_patch4_window12_384_22k.pth')
BERT_WEIGHTS = os.path.join(WEIGHTS_DIR, 'bert')

MODEL_CONFIG = Namespace(
    swin_type='base',
    window12=True,
    mha='',
    fusion_drop=0.0,
    ck_bert=BERT_WEIGHTS,  # Use local BERT weights path
    img_size=480,
)

# Global model and tokenizer (lazy loading)
_model = None
_tokenizer = None
_device = None


def get_device():
    """Get the device to run inference on."""
    global _device
    if _device is None:
        _device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {_device}")
    return _device


def get_tokenizer():
    """Load BERT tokenizer (cached)."""
    global _tokenizer
    if _tokenizer is None:
        logger.info(f"Loading BERT tokenizer from {BERT_WEIGHTS}")
        _tokenizer = BertTokenizer.from_pretrained(BERT_WEIGHTS)
        logger.info("Tokenizer loaded successfully")
    return _tokenizer


def get_model():
    """Load CADFormer model with all weights (cached)."""
    global _model
    if _model is not None:
        return _model
    
    device = get_device()
    
    logger.info("="*60)
    logger.info("Loading CADFormer Model")
    logger.info("="*60)
    
    try:
        # Step 1: Create model with Swin backbone weights
        logger.info(f"Step 1: Creating model with Swin backbone from {SWIN_WEIGHTS}")
        _model = lavt_one(pretrained=SWIN_WEIGHTS, args=MODEL_CONFIG)
        logger.info("Model architecture created successfully")
        
        # Step 2: Load fine-tuned CADFormer weights
        logger.info(f"Step 2: Loading CADFormer weights from {CADFORMER_WEIGHTS}")
        checkpoint = torch.load(CADFORMER_WEIGHTS, map_location='cpu', weights_only=False)
        
        # Extract state dict
        if 'model' in checkpoint:
            state_dict = checkpoint['model']
        elif 'state_dict' in checkpoint:
            state_dict = checkpoint['state_dict']
        else:
            state_dict = checkpoint
        
        logger.info(f"Checkpoint contains {len(state_dict)} parameters")
        
        # Load weights
        load_result = _model.load_state_dict(state_dict, strict=False)
        
        if load_result.missing_keys:
            logger.warning(f"Missing keys: {len(load_result.missing_keys)}")
            logger.warning(f"First 5: {load_result.missing_keys[:5]}")
        
        if load_result.unexpected_keys:
            logger.warning(f"Unexpected keys: {len(load_result.unexpected_keys)}")
        
        logger.info("CADFormer weights loaded successfully")
        
        # Step 3: Move to device and set eval mode
        _model = _model.to(device)
        _model.eval()
        
        logger.info(f"Model moved to {device} and set to eval mode")
        logger.info("="*60)
        logger.info("Model loading complete!")
        logger.info("="*60)
        
        return _model
        
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}", exc_info=True)
        raise


def preprocess_image(image_bytes, img_size=480):
    """
    Preprocess image for model input.
    
    Args:
        image_bytes: Raw image bytes
        img_size: Target image size (default 480)
    
    Returns:
        image_tensor: Preprocessed image tensor (1, 3, 480, 480)
        original_image: Original PIL image
        original_size: Original image size (width, height)
    """
    # Load image
    original_image = Image.open(BytesIO(image_bytes)).convert('RGB')
    original_size = original_image.size
    
    # Resize to model input size
    image = original_image.resize((img_size, img_size), Image.BILINEAR)
    
    # Convert to tensor and normalize
    image_array = np.array(image).astype(np.float32) / 255.0
    
    # Normalize with ImageNet stats
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    image_array = (image_array - mean) / std
    
    # Convert to tensor (H, W, C) -> (C, H, W) and ensure float32
    image_tensor = torch.from_numpy(image_array).permute(2, 0, 1).unsqueeze(0).float()
    
    return image_tensor, original_image, original_size


def preprocess_query(query, tokenizer, max_length=20):
    """
    Preprocess text query for model input.
    
    Args:
        query: Natural language query string
        tokenizer: BERT tokenizer
        max_length: Maximum sequence length
    
    Returns:
        input_ids: Token IDs tensor (1, max_length)
        attention_mask: Attention mask tensor (1, max_length)
    """
    # Tokenize
    encoding = tokenizer(
        query,
        padding='max_length',
        max_length=max_length,
        truncation=True,
        return_tensors='pt'
    )
    
    return encoding['input_ids'], encoding['attention_mask']


def postprocess_output(output, original_size):
    """
    Postprocess model output to create final mask.
    
    Args:
        output: Model output tensor (1, 2, 480, 480)
        original_size: Original image size (width, height)
    
    Returns:
        mask: Binary mask as PIL Image
    """
    # Get prediction (argmax over classes)
    pred = output.argmax(dim=1).squeeze(0).cpu().numpy()  # (480, 480)
    
    # Resize to original size
    mask_pil = Image.fromarray((pred * 255).astype(np.uint8))
    mask_pil = mask_pil.resize(original_size, Image.NEAREST)
    
    return mask_pil


def create_overlay(original_image, mask, color=(255, 50, 50), alpha=0.4):
    """
    Create overlay of mask on original image.
    
    Args:
        original_image: PIL Image (original)
        mask: PIL Image (binary mask)
        color: RGB color for mask overlay
        alpha: Transparency (0-1)
    
    Returns:
        overlay: PIL Image with mask overlay
    """
    import cv2
    
    # Convert to numpy
    img_array = np.array(original_image)
    mask_array = np.array(mask)
    
    # Create colored overlay
    overlay = img_array.copy()
    overlay[mask_array > 127] = (
        overlay[mask_array > 127] * (1 - alpha) + 
        np.array(color) * alpha
    ).astype(np.uint8)
    
    # Find contours
    contours, _ = cv2.findContours(
        mask_array, 
        cv2.RETR_EXTERNAL, 
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    # Draw contours
    cv2.drawContours(overlay, contours, -1, (255, 255, 255), 2)
    
    return Image.fromarray(overlay)


def image_to_base64(image):
    """Convert PIL Image to base64 string."""
    if isinstance(image, bytes):
        return base64.b64encode(image).decode('utf-8')
    
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def run_inference(image_bytes, query):
    """
    Run CADFormer inference on an image with a text query.
    
    Args:
        image_bytes: Raw image bytes
        query: Natural language query describing what to segment
        
    Returns:
        Dictionary with segmentation results
    """
    try:
        logger.info(f"Running inference with query: '{query}'")
        
        # Load model and tokenizer
        model = get_model()
        tokenizer = get_tokenizer()
        device = get_device()
        
        # Preprocess
        image_tensor, original_image, original_size = preprocess_image(
            image_bytes, 
            MODEL_CONFIG.img_size
        )
        input_ids, attention_mask = preprocess_query(query, tokenizer)
        
        # Move to device
        image_tensor = image_tensor.to(device)
        input_ids = input_ids.to(device)
        attention_mask = attention_mask.to(device)
        
        # Run inference
        logger.info("Running model inference...")
        with torch.no_grad():
            output = model(image_tensor, input_ids, attention_mask)
        
        logger.info(f"Model output shape: {output.shape}")
        
        # Check for NaN
        if torch.isnan(output).any():
            logger.error("Model output contains NaN values!")
            return {
                'success': False,
                'error': 'Model produced invalid output',
                'message': 'The model output contains NaN values. Please check model weights.'
            }
        
        # Postprocess
        mask = postprocess_output(output, original_size)
        overlay = create_overlay(original_image, mask)
        
        # Check if mask is empty
        mask_array = np.array(mask)
        coverage = (mask_array > 127).sum() / mask_array.size * 100
        logger.info(f"Mask coverage: {coverage:.2f}%")
        
        # Convert to base64
        result = {
            'success': True,
            'mask': image_to_base64(mask),
            'overlay': image_to_base64(overlay),
            'original': image_to_base64(original_image),
            'query': query,
            'coverage_percent': round(coverage, 2)
        }
        
        logger.info("Inference completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Inference error: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Inference failed',
            'message': str(e)
        }


def is_model_loaded():
    """Check if model is loaded."""
    return _model is not None
