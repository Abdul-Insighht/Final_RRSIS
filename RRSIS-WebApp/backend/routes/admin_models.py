"""
Admin Model Management Routes
API endpoints for managing segmentation models (admin only).
"""
from flask import Blueprint, request, jsonify

from services.storage_service import get_storage
from services.admin_auth_service import admin_required

admin_models_bp = Blueprint('admin_models', __name__, url_prefix='/api/admin/models')


@admin_models_bp.route('', methods=['GET'])
@admin_required
def list_models():
    """Get all segmentation models."""
    storage = get_storage()
    models = storage.get_all_models()
    
    return jsonify({'models': models})


@admin_models_bp.route('/<model_id>', methods=['GET'])
@admin_required
def get_model(model_id):
    """Get a specific model by ID."""
    storage = get_storage()
    model = storage.get_model_by_id(model_id)
    
    if not model:
        return jsonify({'error': 'Model not found'}), 404
    
    return jsonify({'model': model})


@admin_models_bp.route('', methods=['POST'])
@admin_required
def create_model():
    """
    Create a new model configuration.
    Request body: {
        "name": "Model Name",
        "description": "Model description",
        "version": "1.0",
        "status": "enabled" | "disabled"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    # Validate required fields
    required_fields = ['name', 'description', 'version']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    storage = get_storage()
    model = storage.create_model(data)
    
    return jsonify({
        'success': True,
        'model': model
    }), 201


@admin_models_bp.route('/<model_id>', methods=['PUT'])
@admin_required
def update_model(model_id):
    """
    Update a model configuration.
    Can update: name, description, version, status
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    storage = get_storage()
    updated_model = storage.update_model(model_id, data)
    
    if not updated_model:
        return jsonify({'error': 'Model not found'}), 404
    
    return jsonify({
        'success': True,
        'model': updated_model
    })


@admin_models_bp.route('/<model_id>/status', methods=['PUT'])
@admin_required
def update_model_status(model_id):
    """
    Enable or disable a model.
    Request body: { "status": "enabled" | "disabled" }
    """
    data = request.get_json()
    
    if not data or 'status' not in data:
        return jsonify({'error': 'Status is required'}), 400
    
    status = data['status']
    if status not in ['enabled', 'disabled']:
        return jsonify({'error': 'Invalid status. Must be "enabled" or "disabled"'}), 400
    
    storage = get_storage()
    updated_model = storage.update_model(model_id, {'status': status})
    
    if not updated_model:
        return jsonify({'error': 'Model not found'}), 404
    
    return jsonify({
        'success': True,
        'model': updated_model
    })


@admin_models_bp.route('/<model_id>', methods=['DELETE'])
@admin_required
def delete_model(model_id):
    """Delete a model configuration."""
    storage = get_storage()
    success = storage.delete_model(model_id)
    
    if not success:
        return jsonify({'error': 'Model not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'Model deleted successfully'
    })
