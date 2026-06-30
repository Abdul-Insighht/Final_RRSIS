"""
Idempotency Service
Prevents duplicate request processing with time-based key expiry.
"""
import logging
from datetime import datetime, timedelta
from firebase_admin import firestore

logger = logging.getLogger(__name__)

# Idempotency keys expire after 60 seconds
IDEMPOTENCY_TTL_SECONDS = 60

def check_idempotency(key, user_id, operation):
    """
    Check if an idempotency key has been used before.
    
    Args:
        key: Idempotency key (should be unique per request)
        user_id: User ID making the request
        operation: Operation type (e.g., 'payment', 'segmentation')
    
    Returns:
        existing_response: dict | None (None if key is new)
    """
    try:
        db = firestore.client()
        idem_ref = db.collection('idempotency_keys').document(key)
        
        doc = idem_ref.get()
        if not doc.exists:
            return None
        
        idem_data = doc.to_dict()
        
        # Check if expired
        if idem_data.get('expiresAt') and idem_data['expiresAt'] < datetime.utcnow():
            logger.info(f"Idempotency key {key} expired, treating as new")
            return None
        
        # Verify user_id matches (security check)
        if idem_data.get('userId') != user_id:
            logger.warning(f"Idempotency key {key} user mismatch: {idem_data.get('userId')} vs {user_id}")
            return None
        
        # Return cached response
        logger.info(f"Idempotency key {key} found, returning cached response")
        return idem_data.get('response')
        
    except Exception as e:
        logger.error(f"Error checking idempotency key {key}: {e}")
        return None


def store_idempotency(key, user_id, operation, response, status='completed'):
    """
    Store an idempotency key with its response.
    
    Args:
        key: Idempotency key
        user_id: User ID
        operation: Operation type
        response: Response to cache
        status: 'processing' | 'completed' | 'failed'
    
    Returns:
        success: bool
    """
    try:
        db = firestore.client()
        idem_ref = db.collection('idempotency_keys').document(key)
        
        expires_at = datetime.utcnow() + timedelta(seconds=IDEMPOTENCY_TTL_SECONDS)
        
        idem_ref.set({
            'key': key,
            'userId': user_id,
            'operation': operation,
            'status': status,
            'response': response,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': expires_at
        })
        
        logger.info(f"Stored idempotency key {key} for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error storing idempotency key {key}: {e}")
        return False


def cleanup_expired_keys():
    """
    Background job to remove expired idempotency keys.
    Should be run periodically (e.g., every minute).
    
    Returns:
        count: Number of keys cleaned up
    """
    try:
        db = firestore.client()
        now = datetime.utcnow()
        
        # Find expired keys
        expired_query = db.collection('idempotency_keys')\
            .where('expiresAt', '<', now)\
            .limit(100)  # Process in batches
        
        expired_keys = expired_query.get()
        count = 0
        
        batch = db.batch()
        for key_doc in expired_keys:
            batch.delete(key_doc.reference)
            count += 1
        
        if count > 0:
            batch.commit()
            logger.info(f"Cleaned up {count} expired idempotency keys")
        
        return count
        
    except Exception as e:
        logger.error(f"Idempotency cleanup error: {e}")
        return 0
