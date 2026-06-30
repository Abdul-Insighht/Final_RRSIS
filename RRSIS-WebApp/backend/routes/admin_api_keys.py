"""
Admin API Key Management Routes
API endpoints for managing API keys (admin only).
"""
from flask import Blueprint, request, jsonify
import uuid

from services.storage_service import get_storage
from services.admin_auth_service import admin_required

admin_api_keys_bp = Blueprint('admin_api_keys', __name__, url_prefix='/api/admin/api-keys')


@admin_api_keys_bp.route('', methods=['GET'])
@admin_required
def list_api_keys():
    """Get all API keys."""
    storage = get_storage()
    api_keys = storage.get_all_api_keys()
    
    # Mask the actual keys for security (show only last 4 characters)
    masked_keys = []
    for key in api_keys:
        masked_key = key.copy()
        if 'key' in masked_key and len(masked_key['key']) > 4:
            masked_key['key'] = '****' + masked_key['key'][-4:]
        masked_keys.append(masked_key)
    
    return jsonify({'api_keys': masked_keys})


@admin_api_keys_bp.route('', methods=['POST'])
@admin_required
def create_api_key():
    """
    Create a new API key.
    Request body: { "name": "My API Key" }
    """
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Key name is required'}), 400
    
    storage = get_storage()
    
    # Generate a new API key
    key_data = {
        'name': data['name'],
        'key': str(uuid.uuid4()),  # Generate unique key
    }
    
    created_key = storage.create_api_key(key_data)
    
    return jsonify({
        'success': True,
        'api_key': created_key,
        'message': 'API key created successfully. Save this key - it will not be shown again.'
    }), 201


@admin_api_keys_bp.route('/<key_id>/rotate', methods=['PUT'])
@admin_required
def rotate_api_key(key_id):
    """
    Rotate an API key (revoke old, create new).
    Returns the new key.
    """
    storage = get_storage()
    new_key = storage.rotate_api_key(key_id)
    
    if not new_key:
        return jsonify({'error': 'API key not found'}), 404
    
    return jsonify({
        'success': True,
        'api_key': new_key,
        'message': 'API key rotated successfully. Save this new key - it will not be shown again.'
    })


@admin_api_keys_bp.route('/<key_id>/revoke', methods=['PUT'])
@admin_required
def revoke_api_key(key_id):
    """Revoke an API key (mark as inactive)."""
    storage = get_storage()
    success = storage.revoke_api_key(key_id)
    
    if not success:
        return jsonify({'error': 'API key not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'API key revoked successfully'
    })


@admin_api_keys_bp.route('/<key_id>', methods=['DELETE'])
@admin_required
def delete_api_key(key_id):
    """Delete an API key permanently."""
    storage = get_storage()
    success = storage.delete_api_key(key_id)
    
    if not success:
        return jsonify({'error': 'API key not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'API key deleted successfully'
    })
