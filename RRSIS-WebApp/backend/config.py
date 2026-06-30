"""
Flask Backend Configuration
Centralized configuration management for the GeoSegAI backend.
"""
import os
from datetime import timedelta


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'geosegai-dev-secret-key-2024')
    DEBUG = False
    
    # JWT settings
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'geosegai-jwt-secret-2024')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175').split(',')
    
    # Storage settings (for future database integration)
    STORAGE_TYPE = os.environ.get('STORAGE_TYPE', 'memory')  # 'memory' or 'database'
    
    # Upload settings
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'gif', 'webp', 'svg'}


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    # In production, these should be set via environment variables
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')


class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = True
    TESTING = True


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get the current configuration based on environment."""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])
