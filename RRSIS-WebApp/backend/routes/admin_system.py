"""
Admin System Configuration Routes
API endpoints for system settings and statistics (admin only).
"""
import os
from flask import Blueprint, request, jsonify

from services.storage_service import get_storage
from services.admin_auth_service import admin_required

admin_system_bp = Blueprint('admin_system', __name__, url_prefix='/api/admin/system')


@admin_system_bp.route('/config', methods=['GET'])
@admin_required
def get_system_config():
    """Get system configuration settings."""
    storage = get_storage()
    config = storage.get_system_config()
    
    return jsonify({'config': config})


@admin_system_bp.route('/config', methods=['PUT'])
@admin_required
def update_system_config():
    """
    Update system configuration settings.
    Request body: any configuration fields to update
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    storage = get_storage()
    updated_config = storage.update_system_config(data)
    
    return jsonify({
        'success': True,
        'config': updated_config
    })


@admin_system_bp.route('/stats', methods=['GET'])
@admin_required
def get_system_stats():
    """Get system-wide statistics for admin dashboard."""
    storage = get_storage()
    stats = storage.get_system_stats()
    
    return jsonify({'stats': stats})


@admin_system_bp.route('/storage', methods=['GET'])
@admin_required
def get_storage_usage():
    """Calculate and return the total size of the uploads folder in MB."""
    try:
        # Get the uploads directory path
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        uploads_dir = os.path.join(backend_dir, 'uploads')
        
        # Calculate total size
        total_size = 0
        if os.path.exists(uploads_dir):
            for dirpath, dirnames, filenames in os.walk(uploads_dir):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    if os.path.exists(filepath):
                        total_size += os.path.getsize(filepath)
        
        # Convert bytes to MB
        size_mb = round(total_size / (1024 * 1024), 2)
        
        return jsonify({
            'success': True,
            'storageUsedMB': size_mb,
            'storageUsedBytes': total_size
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'storageUsedMB': 0
        }), 500

