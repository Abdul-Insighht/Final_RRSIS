"""
Segmentation Routes
API endpoints for CADFormer-based image segmentation.
"""
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import logging
import os
import uuid
import base64
from PIL import Image
import io

from services.auth_service import token_required
from services.model_registry import run_model_inference, is_model_integrated, is_model_ready

logger = logging.getLogger(__name__)

segmentation_bp = Blueprint('segmentation', __name__, url_prefix='/api')


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg'})


def save_image_file(image_bytes, project_id, file_type='original', original_filename='image.png'):
    """
    Save image to disk using Werkzeug and return URL.
    
    Args:
        image_bytes: Image data as bytes
        project_id: Project ID for organizing files
        file_type: 'original' or 'mask'
        original_filename: Original filename for extension detection
    
    Returns:
        URL path to saved image
    """
    try:
        # Get file extension
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        
        # Generate filename
        if file_type == 'original':
            filename = secure_filename(f"{project_id}_original.{ext}")
        else:  # mask
            unique_id = str(uuid.uuid4())[:8]
            filename = secure_filename(f"{project_id}_{unique_id}_mask.png")
        
        # Ensure upload folder exists
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        # Save file
        filepath = os.path.join(upload_folder, filename)
        with open(filepath, 'wb') as f:
            f.write(image_bytes)
        
        # Return URL (relative to backend server)
        return f"/uploads/{filename}"
    
    except Exception as e:
        logger.error(f"Error saving image file: {str(e)}")
        return None


@segmentation_bp.route('/segment', methods=['POST'])
# @token_required  # TODO: Replace with Firebase token verification
def segment_image():
    """
    Run CADFormer segmentation on an uploaded image.
    
    Request: multipart/form-data with:
        - image: Image file
        - query: Natural language query describing what to segment
        - model: Model to use (cadformer, segformer, unet, deeplabv3)
        - project_id: (optional) Project ID to check if image already exists
    
    Response:
        - success: True if segmentation succeeded
        - mask: Base64-encoded segmentation mask (for immediate display)
        - overlay: Base64-encoded image with mask overlay (for immediate display)
        - original: Base64-encoded original image (for immediate display)
        - original_url: URL to saved original image (for permanent storage)
        - mask_url: URL to saved mask image (for permanent storage)
        - query: The query that was used
        - model: The model that was used
    """
    try:
        # Validate image file
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Validate query
        query = request.form.get('query', '').strip()
        if not query:
            return jsonify({'error': 'No query provided'}), 400
        
        # Get selected model (default to cadformer if not specified)
        model = request.form.get('model', 'cadformer').strip().lower()
        
        # Get project_id and user_id
        project_id = request.form.get('project_id', '').strip()
        user_id = request.form.get('user_id', '').strip()
        
        
        # Validate user_id represents a real user context for crediting
        if not user_id:
            logger.warning("Segmentation request missing user_id")
            return jsonify({'error': 'User identification required for credit processing'}), 400

        # ===== CREDIT RESERVATION PATTERN =====
        # Reserve credits BEFORE running inference
        from services.reservation_service import reserve_credits, commit_reservation, release_reservation
        
        reservation_metadata = {
            'operation': 'segmentation',
            'query': query[:50],  # Truncate for storage
            'model': model,
            'projectId': project_id or None
        }
        
        success, reservation_id_or_error = reserve_credits(user_id, 1, reservation_metadata)
        if not success:
            logger.warning(f"Credit reservation failed for user {user_id}: {reservation_id_or_error}")
            return jsonify({'error': reservation_id_or_error}), 402
        
        reservation_id = reservation_id_or_error
        logger.info(f"Reserved 1 credit for user {user_id}, reservation: {reservation_id}")

        # Validate model is integrated
        if not is_model_integrated(model):
            # Release reservation before returning error
            release_reservation(reservation_id, f"Model {model} not integrated")
            logger.warning(f"User attempted to use non-integrated model: {model}")
            return jsonify({
                'success': False,
                'error': f'Model "{model}" is not integrated yet. Please check available models.'
            }), 400
        
        # Read image bytes
        image_bytes = image_file.read()
        
        logger.info(f"Processing segmentation request - User: {user_id}, Model: {model}, Query: {query}, Project: {project_id or 'None'}")
        
        # ===== RUN INFERENCE (PROTECTED BY RESERVATION) =====
        try:
            # Run inference dynamically with the selected model
            result = run_model_inference(model, image_bytes, query)
            
            if not result.get('success'):
                # Release reservation on inference failure
                release_reservation(reservation_id, "Inference failed")
                return jsonify(result), 500
            
            # Save images to disk if project_id is provided
            original_url = None
            mask_url = None
            overlay_url = None
            
            if project_id:
                # Generate unique ID for this query's images
                unique_id = str(uuid.uuid4())[:8]
                upload_folder = current_app.config['UPLOAD_FOLDER']
                os.makedirs(upload_folder, exist_ok=True)
                
                # Save original image (unique for each query)
                try:
                    ext = image_file.filename.rsplit('.', 1)[1].lower() if '.' in image_file.filename else 'png'
                    original_filename = secure_filename(f"{project_id}_{unique_id}_original.{ext}")
                    original_filepath = os.path.join(upload_folder, original_filename)
                    with open(original_filepath, 'wb') as f:
                        f.write(image_bytes)
                    original_url = f"/uploads/{original_filename}"
                    logger.info(f"Saved original image: {original_url}")
                except Exception as e:
                    logger.error(f"Error saving original image: {str(e)}")
                
                # Save mask image (unique for each query)
                if result.get('mask'):
                    try:
                        mask_base64 = result['mask'].split(',')[1] if ',' in result['mask'] else result['mask']
                        mask_bytes = base64.b64decode(mask_base64)
                        mask_filename = secure_filename(f"{project_id}_{unique_id}_mask.png")
                        mask_filepath = os.path.join(upload_folder, mask_filename)
                        with open(mask_filepath, 'wb') as f:
                            f.write(mask_bytes)
                        mask_url = f"/uploads/{mask_filename}"
                        logger.info(f"Saved mask image: {mask_url}")
                    except Exception as e:
                        logger.error(f"Error saving mask: {str(e)}")
                
                # Save overlay image (unique for each query)
                if result.get('overlay'):
                    try:
                        overlay_base64 = result['overlay'].split(',')[1] if ',' in result['overlay'] else result['overlay']
                        overlay_bytes = base64.b64decode(overlay_base64)
                        overlay_filename = secure_filename(f"{project_id}_{unique_id}_overlay.png")
                        overlay_filepath = os.path.join(upload_folder, overlay_filename)
                        with open(overlay_filepath, 'wb') as f:
                            f.write(overlay_bytes)
                        overlay_url = f"/uploads/{overlay_filename}"
                        logger.info(f"Saved overlay image: {overlay_url}")
                    except Exception as e:
                        logger.error(f"Error saving overlay: {str(e)}")
            
            # Add URLs and model name to result
            from services.model_registry import MODEL_REGISTRY
            registry_entry = MODEL_REGISTRY.get(model.lower())
            result['model'] = registry_entry['name'] if registry_entry else model.upper()
            result['original_url'] = original_url
            result['mask_url'] = mask_url
            result['overlay_url'] = overlay_url
            
            logger.info(f"Segmentation successful - Original: {original_url}, Mask: {mask_url}, Overlay: {overlay_url}")
            
            # ===== COMMIT RESERVATION (FINALIZE CREDIT DEDUCTION) =====
            commit_success, transaction_id_or_error = commit_reservation(
                reservation_id,
                f"Segmentation: {query[:30]}..."
            )
            
            if not commit_success:
                # This is critical - inference succeeded but we can't charge
                # Log error but still return results (user already got value)
                logger.error(f"CRITICAL: Reservation commit failed for {reservation_id}: {transaction_id_or_error}")
                # Consider: Should we still return results? Or release reservation and fail?
                # Decision: Return results but log for manual review
                result['warning'] = 'Credit processing delayed - contact support if balance incorrect'
            else:
                logger.info(f"Committed reservation {reservation_id} → transaction {transaction_id_or_error}")
            
            return jsonify(result)
            
        except Exception as e:
            # Release reservation on any error
            release_reservation(reservation_id, f"Error: {str(e)[:100]}")
            logger.error(f"Segmentation error: {str(e)}", exc_info=True)
            return jsonify({
                'error': 'Segmentation failed',
                'details': str(e)
            }), 500

    
    except Exception as e:
        logger.error(f"Segmentation error: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Segmentation failed',
            'details': str(e)
        }), 500


@segmentation_bp.route('/segment/status', methods=['GET'])
def segment_status():
    """Check if the integrated models are loaded and ready."""
    from services.model_registry import MODEL_REGISTRY, is_model_ready
    status_dict = {}
    any_loaded = False
    for model_id in MODEL_REGISTRY:
        loaded = is_model_ready(model_id)
        status_dict[f"{model_id.replace('-', '')}_loaded"] = loaded
        if loaded:
            any_loaded = True
            
    status_dict['status'] = 'ready' if any_loaded else 'model_not_loaded'
    return jsonify(status_dict)
