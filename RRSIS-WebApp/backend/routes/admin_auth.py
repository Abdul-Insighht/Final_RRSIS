"""
Admin Authentication Routes
API endpoints for admin login, profile, and logout.
"""
from flask import Blueprint, request, jsonify

from services.admin_auth_service import (
    verify_admin_credentials,
    generate_admin_token,
    get_admin_profile,
    admin_required
)

admin_auth_bp = Blueprint('admin_auth', __name__, url_prefix='/api/admin')


@admin_auth_bp.route('/login', methods=['POST'])
def admin_login():
    """
    Admin login endpoint.
    
    Request body:
    {
        "email": "admin@geosegai.ai",
        "password": "admin123"
    }
    
    Returns admin user data and JWT token with admin role.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    # Verify admin credentials
    if not verify_admin_credentials(email, password):
        return jsonify({'error': 'Invalid admin credentials'}), 401
    
    # Generate admin token
    token = generate_admin_token(email)
    admin_profile = get_admin_profile()
    
    return jsonify({
        'success': True,
        'admin': admin_profile,
        'token': token
    })


@admin_auth_bp.route('/me', methods=['GET'])
@admin_required
def get_admin_me():
    """
    Get current admin's profile.
    Requires admin authentication.
    """
    admin_profile = get_admin_profile()
    return jsonify({'admin': admin_profile})


@admin_auth_bp.route('/logout', methods=['POST'])
@admin_required
def admin_logout():
    """
    Admin logout endpoint.
    Token invalidation is handled client-side by removing the token.
    """
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })
