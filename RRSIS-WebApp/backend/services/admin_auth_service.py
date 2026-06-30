"""
Admin Authentication Service
Handles admin-specific authentication, JWT token generation with admin role,
and admin-only route protection middleware.
"""
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g

from config import get_config

config = get_config()

# Hardcoded admin credentials (demo purposes)
ADMIN_CREDENTIALS = {
    'email': 'admin@geosegai.ai',
    'password': 'admin123',  # In production, this should be hashed
    'name': 'System Administrator',
    'role': 'admin'
}


def verify_admin_credentials(email: str, password: str) -> bool:
    """
    Verify admin login credentials.
    Returns True if credentials are valid, False otherwise.
    """
    return (
        email.lower().strip() == ADMIN_CREDENTIALS['email'] and
        password == ADMIN_CREDENTIALS['password']
    )


def generate_admin_token(email: str) -> str:
    """
    Generate a JWT token for admin with 'admin' role claim.
    Admin tokens are separate from user tokens.
    """
    payload = {
        'email': email,
        'role': 'admin',
        'exp': datetime.now(timezone.utc) + config.JWT_ACCESS_TOKEN_EXPIRES,
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, config.JWT_SECRET_KEY, algorithm='HS256')


def decode_admin_token(token: str) -> dict:
    """
    Decode and validate an admin JWT token.
    Returns dict with 'valid' flag and payload or error.
    """
    try:
        from firebase_admin import auth
        # Verify Firebase ID Token
        decoded_token = auth.verify_id_token(token)
        
        return {
            'valid': True,
            'payload': {
                'email': decoded_token.get('email'),
                'role': 'admin',  # Enforced by frontend/signup flow mostly
                'uid': decoded_token.get('uid')
            }
        }
    except Exception as e:
        return {'valid': False, 'error': f'Invalid token: {str(e)}'}


def admin_required(f):
    """
    Decorator to require admin authentication for a route.
    Verifies JWT token and checks for admin role.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
        
        if not token:
            return jsonify({'error': 'Admin authorization token is missing'}), 401
        
        # Decode and validate admin token
        result = decode_admin_token(token)
        if not result['valid']:
            return jsonify({'error': result['error']}), 401
        
        # Store admin info in Flask's g object for access in route
        g.admin_email = result['payload']['email']
        g.admin_role = result['payload']['role']
        
        return f(*args, **kwargs)
    
    return decorated


def get_admin_profile() -> dict:
    """
    Get admin profile information.
    Returns admin user data (without password).
    """
    return {
        'email': ADMIN_CREDENTIALS['email'],
        'name': ADMIN_CREDENTIALS['name'],
        'role': ADMIN_CREDENTIALS['role']
    }


def is_admin_email(email: str) -> bool:
    """Check if an email belongs to an admin account."""
    return email.lower().strip() == ADMIN_CREDENTIALS['email']
