"""
Model Registry
Centralized registry for all integrated segmentation models in the backend.
To integrate a new model, developers simply add an entry to the MODEL_REGISTRY dictionary.
"""
import logging
from services.cadformer_service import run_inference as run_cadformer, is_model_loaded as is_cadformer_loaded
from services.rsotsam3_service import run_rsotsam3_inference as run_rsotsam3, is_rsotsam3_model_loaded as is_rsotsam3_loaded

logger = logging.getLogger(__name__)

# Registry mapping model IDs to metadata and execution handlers
MODEL_REGISTRY = {
    'cadformer': {
        'id': 'cadformer',
        'name': 'CADFormer',
        'description': 'Context-Aware and Decoding Transformer for Referring Remote Sensing Image Segmentation (RRSIS)',
        'version': '1.0',
        'status': 'enabled',
        'inference_fn': run_cadformer,
        'is_loaded_fn': is_cadformer_loaded
    },
    'rs-ot-sam3': {
        'id': 'rs-ot-sam3',
        'name': 'RS-OT-SAM3',
        'description': 'Remote Sensing - Optimal Transport - SAM3 (Optimal Transport alignment with Segment Anything 3 backbone)',
        'version': '1.0',
        'status': 'enabled',
        'inference_fn': run_rsotsam3,
        'is_loaded_fn': is_rsotsam3_loaded
    }
}

def get_integrated_models():
    """
    Returns a list of model metadata dicts.
    Used for database synchronization.
    """
    models_list = []
    for model_id, model_info in MODEL_REGISTRY.items():
        models_list.append({
            'id': model_info['id'],
            'name': model_info['name'],
            'description': model_info['description'],
            'version': model_info['version'],
            'status': model_info['status']
        })
    return models_list

def is_model_integrated(model_id: str) -> bool:
    """Check if a model ID is integrated in the codebase registry."""
    if not model_id:
        return False
    return model_id.lower() in MODEL_REGISTRY

def run_model_inference(model_id: str, image_bytes: bytes, query_text: str) -> dict:
    """
    Run segmentation inference dynamically using the registered model.
    """
    mid_lower = model_id.lower()
    if not is_model_integrated(mid_lower):
        logger.error(f"Inference requested for non-integrated model: {model_id}")
        return {
            'success': False,
            'error': f"Model '{model_id}' is not integrated in this backend installation."
        }
    
    inference_fn = MODEL_REGISTRY[mid_lower]['inference_fn']
    return inference_fn(image_bytes, query_text)

def is_model_ready(model_id: str) -> bool:
    """Check if the model's weights and layers are loaded into memory."""
    mid_lower = model_id.lower()
    if not is_model_integrated(mid_lower):
        return False
    return MODEL_REGISTRY[mid_lower]['is_loaded_fn']()
