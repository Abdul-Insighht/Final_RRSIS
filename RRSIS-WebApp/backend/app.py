"""
GeoSegAI Backend - Flask Application
Main entry point for the Flask backend server.
"""
import os
import sys

# Add the backend directory to the path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify
from flask_cors import CORS

from config import get_config
from routes.segmentation import segmentation_bp

# Admin routes
from routes.admin_auth import admin_auth_bp
from routes.admin_users import admin_users_bp
from routes.admin_api_keys import admin_api_keys_bp
from routes.admin_models import admin_models_bp
from routes.admin_system import admin_system_bp
from routes.payments import payments_bp

# Initialize Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials

def init_firebase_admin():
    try:
        if not firebase_admin._apps:
            # Check for service account key file
            cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                print(f"Firebase Admin SDK initialized with credentials at: {cred_path}")
            else:
                # Use default credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
                # or initialize without creds for some services (though Auth usually needs it)
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized with default credentials.")
    except Exception as e:
        print(f"WARNING: Failed to initialize Firebase Admin SDK: {e}")
        print("Backend token verification will likely fail.")

def sync_integrated_models_to_firestore():
    try:
        from firebase_admin import firestore
        from datetime import datetime, timezone
        from services.model_registry import get_integrated_models
        
        db = firestore.client()
        integrated_models = get_integrated_models()
        integrated_ids = {m['id'] for m in integrated_models}
        
        models_ref = db.collection('models')
        
        # 1. Sync registered models from codebase to Firestore
        for model in integrated_models:
            doc_ref = models_ref.document(model['id'])
            doc_snap = doc_ref.get()
            
            if not doc_snap.exists:
                model_data = {
                    'id': model['id'],
                    'name': model['name'],
                    'description': model['description'],
                    'version': model['version'],
                    'status': model['status'],
                    'isIntegrated': True,
                    'createdAt': datetime.now(timezone.utc),
                    'updatedAt': datetime.now(timezone.utc),
                    'performance': {
                        'avgInferenceTime': 0.0,
                        'successRate': 100.0,
                        'totalQueries': 0,
                        'lastHealthCheck': datetime.now(timezone.utc)
                    }
                }
                doc_ref.set(model_data)
                print(f"[Auto-Sync] Registered model '{model['name']}' in Firestore database.")
            else:
                # Update existing model metadata to match registry, set isIntegrated=True
                doc_ref.update({
                    'name': model['name'],
                    'description': model['description'],
                    'version': model['version'],
                    'isIntegrated': True,
                    'updatedAt': datetime.now(timezone.utc)
                })
                print(f"[Auto-Sync] Verified metadata of model '{model['name']}' in Firestore.")

        # 2. Flag models in Firestore that are NOT in code registry
        all_docs = models_ref.stream()
        for doc in all_docs:
            doc_data = doc.to_dict()
            model_id = doc.id
            if model_id not in integrated_ids:
                if doc_data.get('isIntegrated') is not False:
                    models_ref.document(model_id).update({
                        'isIntegrated': False,
                        'updatedAt': datetime.now(timezone.utc)
                    })
                    print(f"[Auto-Sync] Marked database model '{model_id}' as isIntegrated=False (code pending).")
    except Exception as e:
        print(f"WARNING: Failed to auto-sync integrated models: {e}")

# Call initialization & sync
init_firebase_admin()
sync_integrated_models_to_firestore()


def create_app(config_class=None):
    """
    Application factory for creating Flask app.
    Enables testing with different configurations.
    """
    app = Flask(__name__)
    
    # Load configuration
    if config_class is None:
        config_class = get_config()
    app.config.from_object(config_class)
    
    # Enable CORS for frontend communication
    CORS(app, 
         origins=config_class.CORS_ORIGINS,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'Idempotency-Key'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Register blueprints (API routes)
    app.register_blueprint(segmentation_bp)
    app.register_blueprint(payments_bp)
    
    # Register admin blueprints
    app.register_blueprint(admin_auth_bp)
    app.register_blueprint(admin_users_bp)
    app.register_blueprint(admin_api_keys_bp)
    app.register_blueprint(admin_models_bp)
    app.register_blueprint(admin_system_bp)
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Simple health check endpoint."""
        return jsonify({
            'status': 'healthy',
            'service': 'GeoSegAI Backend',
            'version': '1.0.0'
        })
    
    # Static file serving for uploaded images
    @app.route('/uploads/<filename>', methods=['GET'])
    def uploaded_file(filename):
        """Serve uploaded images and masks."""
        from flask import send_from_directory
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def index():
        """Root endpoint with API information."""
        return jsonify({
            'name': 'GeoSegAI Backend API',
            'version': '1.0.0',
            'endpoints': {
                'health': '/api/health',
                'auth': {
                    'signup': 'POST /api/auth/signup',
                    'login': 'POST /api/auth/login',
                    'me': 'GET /api/auth/me'
                },
                'dashboard': {
                    'stats': 'GET /api/dashboard/stats',
                    'activities': 'GET /api/dashboard/activities'
                },
                'projects': {
                    'list': 'GET /api/projects',
                    'create': 'POST /api/projects',
                    'get': 'GET /api/projects/:id',
                    'update': 'PUT /api/projects/:id',
                    'delete': 'DELETE /api/projects/:id'
                },
                'segmentation': {
                    'segment': 'POST /api/segment',
                    'status': 'GET /api/segment/status'
                }
            },

        })
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app


# Create the app instance
app = create_app()


if __name__ == '__main__':
    print("=" * 50)
    print("GeoSegAI Backend Server")
    print("=" * 50)
    print(f"Running on: http://localhost:5000")
    print(f"Demo credentials: demo@geosegai.ai / demo123")
    print("=" * 50)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
