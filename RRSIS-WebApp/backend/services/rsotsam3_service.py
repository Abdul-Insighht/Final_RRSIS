"""
RS-OT-SAM3 Inference Service
Enhanced RRSIS with Unbalanced Optimal Transport + SAM3 backbone.
"""
import os
import sys
import base64
import logging
import numpy as np
from PIL import Image
from io import BytesIO

# Add code directory to path so that lib/ and sam3/ modules are importable
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
RSOTSAM3_CODE_DIR = os.path.join(
    backend_dir, 'models', 'rsotsam3'
)
RSOTSAM3_WEIGHTS = os.path.join(
    backend_dir, 'weights', 'RS-OT-SAM3', 'best_model.pth'
)
RSOTSAM3_BASE_SAM3 = os.path.join(
    backend_dir, 'weights', 'RS-OT-SAM3', 'sam3.pt'
)

# Insert the code directory so `lib` and `sam3` packages resolve correctly
if RSOTSAM3_CODE_DIR not in sys.path:
    sys.path.insert(0, RSOTSAM3_CODE_DIR)

# Optional heavy ML dependencies — server starts even if these are absent
NO_ML = False
try:
    import torch
    import torch.nn.functional as F
except ImportError as _ml_err:
    NO_ML = True
    logging.warning(
        f"ML dependencies not available ({_ml_err}). "
        "RS-OT-SAM3 inference will be disabled."
    )

logger = logging.getLogger(__name__)

# Model configuration
RSOTSAM3_IMAGE_SIZE = 504  # Must be divisible by 14 for SAM3 ViT

# Global model (lazy loading)
_rsotsam3_model = None
_rsotsam3_device = None


def _get_device():
    """Get the device to run inference on."""
    global _rsotsam3_device
    if _rsotsam3_device is None:
        _rsotsam3_device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"[RS-OT-SAM3] Using device: {_rsotsam3_device}")
    return _rsotsam3_device


def _get_model():
    """Load Enhanced_RRSIS_UOT model with fine-tuned weights (cached)."""
    global _rsotsam3_model
    if _rsotsam3_model is not None:
        return _rsotsam3_model

    device = _get_device()

    logger.info("=" * 60)
    logger.info("Loading RS-OT-SAM3 Model")
    logger.info("=" * 60)

    try:
        # Import the model class from the RS-OT-SAM3 code directory
        from lib.enhanced_model import Enhanced_RRSIS_UOT

        # Step 1: Create model — using local SAM3 base weights
        logger.info(f"Step 1: Creating Enhanced_RRSIS_UOT model (using local SAM3 backbone at: {RSOTSAM3_BASE_SAM3})...")
        _rsotsam3_model = Enhanced_RRSIS_UOT(
            sam3_ckpt=RSOTSAM3_BASE_SAM3,
            image_size=RSOTSAM3_IMAGE_SIZE,
            lora_rank=16,
            lora_alpha=32.0,
            use_dynamic_lora=True,
            use_contrastive_loss=True,
            use_multiscale_ot=True,
            use_ohem_loss=True,
        )
        logger.info("Model architecture created successfully")

        # Step 2: Load fine-tuned weights
        logger.info(f"Step 2: Loading fine-tuned weights from {RSOTSAM3_WEIGHTS}")
        ckpt = torch.load(RSOTSAM3_WEIGHTS, map_location='cpu', weights_only=False)
        _rsotsam3_model.load_state_dict(ckpt['model_state_dict'], strict=False)

        if 'epoch' in ckpt:
            logger.info(f"  Loaded from epoch {ckpt['epoch']}, best_iou={ckpt.get('best_iou', '?')}")

        logger.info("Fine-tuned weights loaded successfully")

        # Step 3: Move to device and set eval mode
        _rsotsam3_model = _rsotsam3_model.to(device)
        _rsotsam3_model.eval()

        logger.info(f"Model moved to {device} and set to eval mode")
        logger.info("=" * 60)
        logger.info("RS-OT-SAM3 model loading complete!")
        logger.info("=" * 60)

        return _rsotsam3_model

    except Exception as e:
        logger.error(f"Error loading RS-OT-SAM3 model: {str(e)}", exc_info=True)
        _rsotsam3_model = None
        raise


def _preprocess_image(image_bytes, img_size=RSOTSAM3_IMAGE_SIZE):
    """
    Preprocess image for RS-OT-SAM3 model input.

    Args:
        image_bytes: Raw image bytes
        img_size: Target image size (default 504)

    Returns:
        image_tensor: Preprocessed image tensor (1, 3, 504, 504)
        original_image: Original PIL image
        original_size: Original image size (width, height)
    """
    # Load image
    original_image = Image.open(BytesIO(image_bytes)).convert('RGB')
    original_size = original_image.size

    # Resize to model input size
    image = original_image.resize((img_size, img_size), Image.BILINEAR)

    # Convert to tensor and normalize to [0, 1]
    image_array = np.array(image).astype(np.float32) / 255.0

    # Convert to tensor (H, W, C) -> (C, H, W) and add batch dimension
    # Note: The model internally normalizes with mean=0.5, std=0.5 → range [-1, 1]
    image_tensor = torch.from_numpy(image_array).permute(2, 0, 1).unsqueeze(0).float()

    return image_tensor, original_image, original_size


def _postprocess_output(output, original_size):
    """
    Postprocess model output to create final mask.

    Args:
        output: Model output dict with 'pred_masks' tensor (1, 1, 504, 504) — logits
        original_size: Original image size (width, height)

    Returns:
        mask: Binary mask as PIL Image
    """
    pred_masks = output['pred_masks']

    # Apply sigmoid to get probabilities, then threshold
    pred_probs = torch.sigmoid(pred_masks)
    pred_binary = (pred_probs > 0.5).float()

    # Squeeze to 2D: (1, 1, H, W) → (H, W)
    pred_np = pred_binary.squeeze().cpu().numpy()

    # Convert to uint8 PIL image and resize to original dimensions
    mask_pil = Image.fromarray((pred_np * 255).astype(np.uint8))
    mask_pil = mask_pil.resize(original_size, Image.NEAREST)

    return mask_pil


def _create_overlay(original_image, mask, color=(50, 150, 255), alpha=0.4):
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


def _image_to_base64(image):
    """Convert PIL Image to base64 string."""
    if isinstance(image, bytes):
        return base64.b64encode(image).decode('utf-8')

    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def run_rsotsam3_inference(image_bytes, query):
    """
    Run RS-OT-SAM3 inference on an image with a text query.

    Args:
        image_bytes: Raw image bytes
        query: Natural language query describing what to segment

    Returns:
        Dictionary with segmentation results
    """
    if NO_ML:
        return {
            'success': False,
            'error': 'ML dependencies not available',
            'message': 'PyTorch is required for RS-OT-SAM3 inference.'
        }

    try:
        logger.info(f"[RS-OT-SAM3] Running inference with query: '{query}'")

        # Load model
        model = _get_model()
        device = _get_device()

        # Preprocess image
        image_tensor, original_image, original_size = _preprocess_image(image_bytes)

        # Move to device
        image_tensor = image_tensor.to(device)

        # The model expects captions as a list of strings
        captions = [query]

        # Run inference
        logger.info("[RS-OT-SAM3] Running model inference...")
        with torch.no_grad():
            with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
                output = model(image_tensor, captions)

        logger.info(f"[RS-OT-SAM3] Model output mask shape: {output['pred_masks'].shape}")

        # Check for NaN
        if torch.isnan(output['pred_masks']).any():
            logger.error("[RS-OT-SAM3] Model output contains NaN values!")
            return {
                'success': False,
                'error': 'Model produced invalid output',
                'message': 'The model output contains NaN values. Please check model weights.'
            }

        # Postprocess
        mask = _postprocess_output(output, original_size)
        overlay = _create_overlay(original_image, mask)

        # Check coverage
        mask_array = np.array(mask)
        coverage = (mask_array > 127).sum() / mask_array.size * 100
        logger.info(f"[RS-OT-SAM3] Mask coverage: {coverage:.2f}%")

        # Convert to base64
        result = {
            'success': True,
            'mask': _image_to_base64(mask),
            'overlay': _image_to_base64(overlay),
            'original': _image_to_base64(original_image),
            'query': query,
            'coverage_percent': round(coverage, 2)
        }

        logger.info("[RS-OT-SAM3] Inference completed successfully")
        return result

    except Exception as e:
        logger.error(f"[RS-OT-SAM3] Inference error: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Inference failed',
            'message': str(e)
        }


def is_rsotsam3_model_loaded():
    """Check if RS-OT-SAM3 model is loaded."""
    return _rsotsam3_model is not None
