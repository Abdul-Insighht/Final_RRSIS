"""
Authentication Service
Handles JWT token generation, validation, and password hashing.
"""
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from config import get_config

config = get_config()


def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return check_password_hash(password_hash, password)


def generate_token(user_id: str, email: str) -> str:
    """Generate a JWT token for a user."""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + config.JWT_ACCESS_TOKEN_EXPIRES,
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, config.JWT_SECRET_KEY, algorithm='HS256')


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=['HS256'])
        return {'valid': True, 'payload': payload}
    except jwt.ExpiredSignatureError:
        return {'valid': False, 'error': 'Token has expired'}
    except jwt.InvalidTokenError as e:
        return {'valid': False, 'error': f'Invalid token: {str(e)}'}


import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin SDK if not already initialized
try:
    firebase_admin.get_app()
except ValueError:
    # Use default credentials (should be set via environment variable or key file)
    # For dev, we might need to set up a service account key
    cred = credentials.Certificate('service-account-key.json') if False else None # Placeholder
    # Assuming the app is already initialized in app.py or we initialize it here
    # For now, let's assume app.py initializes it or we do a basic init
    # NOTE: You need to download serviceAccountKey.json from Firebase Console
    # and place it in the backend directory for this to work locally.
    pass

def token_required(f):
    """Decorator to require a valid Firebase ID token for a route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Verify the ID token
            decoded_token = auth.verify_id_token(token)
            
            # Check for email verification
            if not decoded_token.get('email_verified', False):
                 # Google accounts (provider_id='google.com') are automatically verified even if not explicitly stated sometimes, 
                 # but Firebase usually sets email_verified=True for them.
                 # Strict check as requested.
                 return jsonify({'error': 'Email not verified'}), 403

            # Store user info in g (global context)
            g.current_user_id = decoded_token['uid']
            g.current_user_email = decoded_token.get('email')
            
        except Exception as e:
            return jsonify({'error': 'Invalid token', 'details': str(e)}), 401
            
        return f(*args, **kwargs)
    
    return decorated


def get_current_user_id() -> str:
    """Get the current user's ID from the request context."""
    return getattr(g, 'current_user_id', None)
