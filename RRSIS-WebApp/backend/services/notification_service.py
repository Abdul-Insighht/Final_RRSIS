"""
Notification Service
Handles creation and management of user notifications.
"""
import logging
from firebase_admin import firestore

logger = logging.getLogger(__name__)


def create_credit_adjustment_notification(user_id, action, amount, reason, admin_email, transaction_id):
    """
    Create notification when admin adjusts user credits.
    
    Args:
        user_id: User ID
        action: 'add' or 'deduct'
        amount: Credit amount
        reason: Reason for adjustment
        admin_email: Admin who made the adjustment
        transaction_id: Related transaction ID
    
    Returns:
        (success: bool, notification_id: str | error_message: str)
    """
    try:
        db = firestore.client()
        
        # Create notification message
        action_text = "added" if action == "add" else "deducted"
        message = f"Admin {action_text} {amount} credits for: {reason}"
        
        # Save to Firestore
        notif_ref = db.collection('notifications').document()
        notif_ref.set({
            'id': notif_ref.id,
            'userId': user_id,
            'type': 'credit_adjustment',
            'title': 'Credits Adjusted',
            'message': message,
            'metadata': {
                'action': action,
                'amount': amount,
                'reason': reason,
                'admin_email': admin_email,
                'transaction_id': transaction_id
            },
            'isRead': False,
            'createdAt': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Created notification for user {user_id}: {message}")
        return True, notif_ref.id
        
    except Exception as e:
        logger.error(f"Failed to create notification: {e}", exc_info=True)
        return False, str(e)


def get_user_notifications(user_id, limit=50):
    """
    Get all notifications for a user.
    
    Args:
        user_id: User ID
        limit: Maximum number of notifications to return
    
    Returns:
        List of notifications
    """
    try:
        db = firestore.client()
        
        notifications_ref = db.collection('notifications')
        query = notifications_ref.where('userId', '==', user_id).order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit)
        
        docs = query.stream()
        notifications = []
        
        for doc in docs:
            notifications.append({
                'id': doc.id,
                **doc.to_dict()
            })
        
        return notifications
        
    except Exception as e:
        logger.error(f"Failed to get notifications for user {user_id}: {e}", exc_info=True)
        return []


def mark_notification_as_read(notification_id, user_id):
    """
    Mark a notification as read.
    
    Args:
        notification_id: Notification ID
        user_id: User ID (for security check)
    
    Returns:
        (success: bool, message: str)
    """
    try:
        db = firestore.client()
        notif_ref = db.collection('notifications').document(notification_id)
        
        # Verify notification belongs to user
        notif = notif_ref.get()
        if not notif.exists:
            return False, "Notification not found"
        
        if notif.to_dict().get('userId') != user_id:
            return False, "Unauthorized"
        
        # Update
        notif_ref.update({'isRead': True})
        
        logger.info(f"Marked notification {notification_id} as read for user {user_id}")
        return True, "Notification marked as read"
        
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}", exc_info=True)
        return False, str(e)


def get_unread_count(user_id):
    """
    Get count of unread notifications for a user.
    
    Args:
        user_id: User ID
    
    Returns:
        int: Unread count
    """
    try:
        db = firestore.client()
        
        notifications_ref = db.collection('notifications')
        query = notifications_ref.where('userId', '==', user_id).where('isRead', '==', False)
        
        docs = query.stream()
        count = sum(1 for _ in docs)
        
        return count
        
    except Exception as e:
        logger.error(f"Failed to get unread count for user {user_id}: {e}", exc_info=True)
        return 0
