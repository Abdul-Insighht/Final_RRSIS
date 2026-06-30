"""
Storage Service
Abstract storage layer for user data management.
Currently uses in-memory storage, designed for easy database integration later.
"""
from typing import Dict, List, Optional
from datetime import datetime
import uuid

from data.demo_data import (
    DEMO_USER_ID,
    get_demo_user,
    get_demo_stats,
    get_demo_projects,
    get_demo_activities
)


class InMemoryStorage:
    """
    In-memory storage implementation.
    All data is stored in memory and will be lost on server restart.
    Each user has strictly isolated data access.
    """
    
    def __init__(self):
        """Initialize storage with demo user data."""
        self._users: Dict[str, dict] = {}
        self._projects: Dict[str, dict] = {}
        self._activities: Dict[str, dict] = {}
        self._stats: Dict[str, dict] = {}
        
        # Admin-specific storage
        self._api_keys: Dict[str, dict] = {}
        self._models: Dict[str, dict] = {}
        self._system_config: dict = {}
        
        # Initialize with demo user data
        self._initialize_demo_data()
        self._initialize_admin_data()
    
    def _initialize_demo_data(self):
        """Load demo user and their pre-populated data."""
        # Add demo user
        demo_user = get_demo_user()
        self._users[demo_user['id']] = demo_user
        
        # Add demo stats
        demo_stats = get_demo_stats()
        self._stats[DEMO_USER_ID] = demo_stats
        
        # Add demo projects
        for project in get_demo_projects():
            self._projects[project['id']] = project
        
        # Add demo activities
        for activity in get_demo_activities():
            self._activities[activity['id']] = activity
    
    def _initialize_admin_data(self):
        """Initialize admin-specific data (models, system config)."""
        # Initialize default segmentation models
        default_models = [
            {
                'id': 'cadformer-v1',
                'name': 'CADFormer',
                'description': 'Fine-grained cross-modal alignment and decoding transformer for referring remote sensing image segmentation',
                'version': '1.0',
                'status': 'enabled',
                'created_at': datetime.utcnow().isoformat()
            }
        ]
        
        for model in default_models:
            self._models[model['id']] = model
        
        # Initialize system configuration
        self._system_config = {
            'app_name': 'GeoSegAI',
            'max_upload_size_mb': 50,
            'allowed_image_formats': ['jpg', 'jpeg', 'png', 'tif', 'tiff'],
            'segmentation_timeout_seconds': 300,
            'enable_email_notifications': False
        }
    
    # ============== User Operations ==============
    
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get a user by their ID."""
        return self._users.get(user_id)
    
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get a user by their email address."""
        for user in self._users.values():
            if user['email'].lower() == email.lower():
                return user
        return None
    
    def create_user(self, user_data: dict) -> dict:
        """Create a new user with empty workspace."""
        user_id = user_data.get('id', str(uuid.uuid4()))
        user_data['id'] = user_id
        user_data['created_at'] = datetime.utcnow().isoformat()
        
        # Store user
        self._users[user_id] = user_data
        
        # Initialize empty stats for new user
        self._stats[user_id] = {
            'user_id': user_id,
            'total_images': 0,
            'total_segmentations': 0,
            'storage_used_gb': 0,
            'storage_limit_gb': 100,
            'active_projects': 0
        }
        
        return user_data
    
    def update_user(self, user_id: str, updates: dict) -> Optional[dict]:
        """Update user profile data."""
        if user_id not in self._users:
            return None
        
        # Prevent updating sensitive fields
        protected_fields = ['id', 'password_hash', 'created_at']
        for field in protected_fields:
            updates.pop(field, None)
        
        self._users[user_id].update(updates)
        return self._users[user_id]
    
    # ============== Stats Operations ==============
    
    def get_user_stats(self, user_id: str) -> dict:
        """Get dashboard statistics for a user."""
        stats = self._stats.get(user_id, {
            'user_id': user_id,
            'total_images': 0,
            'total_segmentations': 0,
            'storage_used_gb': 0,
            'storage_limit_gb': 100,
            'active_projects': 0
        })
        return stats
    
    def update_user_stats(self, user_id: str, updates: dict) -> dict:
        """Update user statistics."""
        if user_id not in self._stats:
            self._stats[user_id] = {
                'user_id': user_id,
                'total_images': 0,
                'total_segmentations': 0,
                'storage_used_gb': 0,
                'storage_limit_gb': 100,
                'active_projects': 0
            }
        
        self._stats[user_id].update(updates)
        return self._stats[user_id]
    
    # ============== Project Operations ==============
    
    def get_user_projects(self, user_id: str) -> List[dict]:
        """Get all projects for a specific user. Strict data isolation."""
        return [
            p for p in self._projects.values()
            if p['user_id'] == user_id
        ]
    
    def get_project_by_id(self, project_id: str, user_id: str) -> Optional[dict]:
        """Get a specific project. Only returns if owned by user."""
        project = self._projects.get(project_id)
        if project and project['user_id'] == user_id:
            return project
        return None
    
    def create_project(self, project_data: dict) -> dict:
        """Create a new project for a user."""
        project_id = project_data.get('id', str(uuid.uuid4()))
        project_data['id'] = project_id
        project_data['created_at'] = datetime.utcnow().isoformat()
        
        self._projects[project_id] = project_data
        
        # Update user stats
        user_id = project_data['user_id']
        if user_id in self._stats:
            self._stats[user_id]['active_projects'] = len(self.get_user_projects(user_id))
        
        return project_data
    
    def update_project(self, project_id: str, user_id: str, updates: dict) -> Optional[dict]:
        """Update a project. Only allowed if owned by user."""
        project = self.get_project_by_id(project_id, user_id)
        if not project:
            return None
        
        # Prevent updating ownership
        updates.pop('user_id', None)
        updates.pop('id', None)
        
        self._projects[project_id].update(updates)
        return self._projects[project_id]
    
    def delete_project(self, project_id: str, user_id: str) -> bool:
        """Delete a project. Only allowed if owned by user."""
        project = self.get_project_by_id(project_id, user_id)
        if not project:
            return False
        
        del self._projects[project_id]
        
        # Update user stats
        if user_id in self._stats:
            self._stats[user_id]['active_projects'] = len(self.get_user_projects(user_id))
        
        return True
    
    # ============== Activity Operations ==============
    
    def get_user_activities(self, user_id: str, limit: int = 10) -> List[dict]:
        """Get recent activities for a specific user. Strict data isolation."""
        user_activities = [
            a for a in self._activities.values()
            if a['user_id'] == user_id
        ]
        # Sort by created_at descending (most recent first)
        user_activities.sort(
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )
        return user_activities[:limit]
    
    def create_activity(self, activity_data: dict) -> dict:
        """Create a new activity record for a user."""
        activity_id = activity_data.get('id', str(uuid.uuid4()))
        activity_data['id'] = activity_id
        activity_data['created_at'] = datetime.utcnow().isoformat()
        
        self._activities[activity_id] = activity_data
        return activity_data
    
    # ============== Admin: User Management Operations ==============
    
    def get_all_users(self) -> List[dict]:
        """Get all users (admin only). Returns users without password hashes."""
        return [
            {k: v for k, v in user.items() if k != 'password_hash'}
            for user in self._users.values()
        ]
    
    def update_user_status(self, user_id: str, status: str) -> Optional[dict]:
        """Update user status (active/suspended). Admin only."""
        if user_id not in self._users:
            return None
        
        self._users[user_id]['status'] = status
        return {k: v for k, v in self._users[user_id].items() if k != 'password_hash'}
    
    def delete_user(self, user_id: str) -> bool:
        """Delete a user and all their data. Admin only."""
        if user_id not in self._users:
            return False
        
        # Delete user
        del self._users[user_id]
        
        # Delete user's projects
        user_projects = [pid for pid, p in self._projects.items() if p['user_id'] == user_id]
        for pid in user_projects:
            del self._projects[pid]
        
        # Delete user's activities
        user_activities = [aid for aid, a in self._activities.items() if a['user_id'] == user_id]
        for aid in user_activities:
            del self._activities[aid]
        
        # Delete user's stats
        if user_id in self._stats:
            del self._stats[user_id]
        
        return True
    
    # ============== Admin: API Key Operations ==============
    
    def get_all_api_keys(self) -> List[dict]:
        """Get all API keys. Admin only."""
        return list(self._api_keys.values())
    
    def create_api_key(self, key_data: dict) -> dict:
        """Create a new API key. Admin only."""
        key_id = key_data.get('id', str(uuid.uuid4()))
        key_data['id'] = key_id
        key_data['created_at'] = datetime.utcnow().isoformat()
        key_data['status'] = 'active'
        
        self._api_keys[key_id] = key_data
        return key_data
    
    def rotate_api_key(self, key_id: str) -> Optional[dict]:
        """Rotate an API key (generate new key, revoke old). Admin only."""
        if key_id not in self._api_keys:
            return None
        
        old_key = self._api_keys[key_id]
        old_key['status'] = 'revoked'
        
        # Create new key
        new_key_data = {
            'name': old_key['name'],
            'key': str(uuid.uuid4()),  # Generate new key
        }
        return self.create_api_key(new_key_data)
    
    def revoke_api_key(self, key_id: str) -> bool:
        """Revoke an API key. Admin only."""
        if key_id not in self._api_keys:
            return False
        
        self._api_keys[key_id]['status'] = 'revoked'
        return True
    
    def delete_api_key(self, key_id: str) -> bool:
        """Delete an API key. Admin only."""
        if key_id not in self._api_keys:
            return False
        
        del self._api_keys[key_id]
        return True
    
    # ============== Admin: Model Management Operations ==============
    
    def get_all_models(self) -> List[dict]:
        """Get all segmentation models."""
        return list(self._models.values())
    
    def get_enabled_models(self) -> List[dict]:
        """Get only enabled models (for user dropdown)."""
        return [m for m in self._models.values() if m['status'] == 'enabled']
    
    def get_model_by_id(self, model_id: str) -> Optional[dict]:
        """Get a specific model by ID."""
        return self._models.get(model_id)
    
    def create_model(self, model_data: dict) -> dict:
        """Create a new model configuration. Admin only."""
        model_id = model_data.get('id', str(uuid.uuid4()))
        model_data['id'] = model_id
        model_data['created_at'] = datetime.utcnow().isoformat()
        model_data['status'] = model_data.get('status', 'enabled')
        
        self._models[model_id] = model_data
        return model_data
    
    def update_model(self, model_id: str, updates: dict) -> Optional[dict]:
        """Update a model configuration. Admin only."""
        if model_id not in self._models:
            return None
        
        # Prevent updating ID
        updates.pop('id', None)
        
        self._models[model_id].update(updates)
        return self._models[model_id]
    
    def delete_model(self, model_id: str) -> bool:
        """Delete a model. Admin only."""
        if model_id not in self._models:
            return False
        
        del self._models[model_id]
        return True
    
    # ============== Admin: System Configuration Operations ==============
    
    def get_system_config(self) -> dict:
        """Get system configuration. Admin only."""
        return self._system_config.copy()
    
    def update_system_config(self, updates: dict) -> dict:
        """Update system configuration. Admin only."""
        self._system_config.update(updates)
        return self._system_config.copy()
    
    def get_system_stats(self) -> dict:
        """Get system-wide statistics. Admin only."""
        total_users = len(self._users)
        total_projects = len(self._projects)
        total_activities = len(self._activities)
        active_users = len([u for u in self._users.values() if u.get('status') != 'suspended'])
        
        return {
            'total_users': total_users,
            'active_users': active_users,
            'suspended_users': total_users - active_users,
            'total_projects': total_projects,
            'total_segmentations': total_activities,
            'total_models': len(self._models),
            'enabled_models': len([m for m in self._models.values() if m['status'] == 'enabled'])
        }



# Global storage instance
_storage_instance = None


def get_storage() -> InMemoryStorage:
    """Get the storage instance (singleton pattern)."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = InMemoryStorage()
    return _storage_instance


def reset_storage():
    """Reset storage to initial state. Useful for testing."""
    global _storage_instance
    _storage_instance = InMemoryStorage()
