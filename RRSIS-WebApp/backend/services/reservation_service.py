"""
Credit Reservation Service
Implements reserve → run → commit pattern for credit operations.
Prevents race conditions and ensures transactional safety.
"""
import logging
import uuid
from datetime import datetime, timedelta
from firebase_admin import firestore

logger = logging.getLogger(__name__)

# Reservation expires after 5 minutes if not committed/released
RESERVATION_TIMEOUT_MINUTES = 5

def reserve_credits(user_id, amount, metadata=None):
    """
    Reserve credits for a user before running an operation.
    
    Args:
        user_id: User ID
        amount: Number of credits to reserve
        metadata: Optional dict with operation details (query, operation type, etc.)
    
    Returns:
        (success: bool, reservation_id: str | error_message: str)
    """
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(user_id)
        
        @firestore.transactional
        def create_reservation(transaction, user_ref):
            # Read current balance
            snapshot = user_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise ValueError("User not found")
            
            current_credits = snapshot.to_dict().get('credits', 0)
            
            # Check if sufficient credits available
            if current_credits < amount:
                raise ValueError(f"Insufficient credits. Required: {amount}, Available: {current_credits}")
            
            # Create reservation ID
            reservation_id = f"res_{uuid.uuid4().hex[:12]}"
            
            # Calculate expiry time
            now = datetime.utcnow()
            expires_at = now + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)
            
            # Deduct credits immediately (reserved state)
            new_balance = current_credits - amount
            transaction.update(user_ref, {'credits': new_balance})
            
            # Create reservation record
            reservation_ref = db.collection('reservations').document(reservation_id)
            transaction.set(reservation_ref, {
                'id': reservation_id,
                'userId': user_id,
                'amount': amount,
                'status': 'reserved',
                'createdAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': expires_at,
                'relatedTransactionId': None,
                'metadata': metadata or {}
            })
            
            return reservation_id, new_balance
        
        transaction = db.transaction()
        reservation_id, new_balance = create_reservation(transaction, user_ref)
        
        logger.info(f"Reserved {amount} credits for user {user_id}. Reservation: {reservation_id}, New balance: {new_balance}")
        return True, reservation_id
        
    except ValueError as val_err:
        logger.warning(f"Reservation failed for user {user_id}: {val_err}")
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Reservation error for user {user_id}: {e}", exc_info=True)
        return False, "Reservation failed due to system error"


def commit_reservation(reservation_id, description="Operation completed"):
    """
    Commit a reservation by creating a transaction record.
    The credits were already deducted during reservation.
    
    Args:
        reservation_id: Reservation ID to commit
        description: Transaction description
    
    Returns:
        (success: bool, transaction_id: str | error_message: str)
    """
    try:
        db = firestore.client()
        reservation_ref = db.collection('reservations').document(reservation_id)
        
        @firestore.transactional
        def finalize_reservation(transaction, reservation_ref):
            # Get reservation
            reservation_snap = reservation_ref.get(transaction=transaction)
            if not reservation_snap.exists:
                raise ValueError(f"Reservation {reservation_id} not found")
            
            reservation = reservation_snap.to_dict()
            
            # Validate reservation status
            if reservation['status'] != 'reserved':
                raise ValueError(f"Reservation {reservation_id} is not in reserved state (current: {reservation['status']})")
            
            # Check if expired (handles both timezone-aware and naive datetimes safely)
            from datetime import timezone
            expires_at = reservation.get('expiresAt')
            if expires_at:
                now_utc = datetime.now(timezone.utc) if expires_at.tzinfo else datetime.utcnow()
                if expires_at < now_utc:
                    raise ValueError(f"Reservation {reservation_id} has expired")
            
            # Create transaction ID
            transaction_id = f"tx_{uuid.uuid4().hex[:12]}"
            
            # Create transaction record
            transaction_ref = db.collection('transactions').document(transaction_id)
            transaction.set(transaction_ref, {
                'id': transaction_id,
                'userId': reservation['userId'],
                'type': 'usage',
                'amount': -reservation['amount'],
                'status': 'completed',
                'description': description,
                'reservationId': reservation_id,
                'reversedBy': None,
                'reversalReason': None,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'metadata': reservation.get('metadata', {})
            })
            
            # Update reservation status
            transaction.update(reservation_ref, {
                'status': 'committed',
                'relatedTransactionId': transaction_id
            })
            
            return transaction_id
        
        transaction = db.transaction()
        transaction_id = finalize_reservation(transaction, reservation_ref)
        
        logger.info(f"Committed reservation {reservation_id} → transaction {transaction_id}")
        return True, transaction_id
        
    except ValueError as val_err:
        logger.warning(f"Commit failed for reservation {reservation_id}: {val_err}")
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Commit error for reservation {reservation_id}: {e}", exc_info=True)
        return False, "Commit failed due to system error"


def release_reservation(reservation_id, reason="Operation cancelled"):
    """
    Release a reservation and refund the credits.
    Used when operation fails or is cancelled.
    
    Args:
        reservation_id: Reservation ID to release
        reason: Reason for release
    
    Returns:
        (success: bool, message: str)
    """
    try:
        db = firestore.client()
        reservation_ref = db.collection('reservations').document(reservation_id)
        
        @firestore.transactional
        def cancel_reservation(transaction, reservation_ref):
            # Get reservation
            reservation_snap = reservation_ref.get(transaction=transaction)
            if not reservation_snap.exists:
                raise ValueError(f"Reservation {reservation_id} not found")
            
            reservation = reservation_snap.to_dict()
            
            # Only release if still in reserved state
            if reservation['status'] != 'reserved':
                logger.warning(f"Attempted to release reservation {reservation_id} with status {reservation['status']}")
                return f"Reservation already {reservation['status']}"
            
            # Refund credits to user
            user_ref = db.collection('users').document(reservation['userId'])
            user_snap = user_ref.get(transaction=transaction)
            if user_snap.exists:
                current_credits = user_snap.to_dict().get('credits', 0)
                new_balance = current_credits + reservation['amount']
                transaction.update(user_ref, {'credits': new_balance})
            
            # Update reservation status
            transaction.update(reservation_ref, {
                'status': 'released',
                'metadata': {
                    **reservation.get('metadata', {}),
                    'releaseReason': reason
                }
            })
            
            return f"Released {reservation['amount']} credits"
        
        transaction = db.transaction()
        message = cancel_reservation(transaction, reservation_ref)
        
        logger.info(f"Released reservation {reservation_id}: {reason}")
        return True, message
        
    except ValueError as val_err:
        logger.warning(f"Release failed for reservation {reservation_id}: {val_err}")
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Release error for reservation {reservation_id}: {e}", exc_info=True)
        return False, "Release failed due to system error"


def cleanup_expired_reservations():
    """
    Background job to release expired reservations.
    Should be run periodically (e.g., every minute).
    
    Returns:
        count: Number of reservations cleaned up
    """
    try:
        db = firestore.client()
        now = datetime.utcnow()
        
        # Find expired reservations still in 'reserved' status
        expired_query = db.collection('reservations')\
            .where('status', '==', 'reserved')\
            .where('expiresAt', '<', now)\
            .limit(100)  # Process in batches
        
        expired_reservations = expired_query.get()
        count = 0
        
        for reservation_doc in expired_reservations:
            reservation_id = reservation_doc.id
            success, msg = release_reservation(reservation_id, "Expired - auto-cleanup")
            if success:
                count += 1
        
        if count > 0:
            logger.info(f"Cleaned up {count} expired reservations")
        
        return count
        
    except Exception as e:
        logger.error(f"Cleanup error: {e}", exc_info=True)
        return 0


def get_user_reserved_credits(user_id):
    """
    Get total credits currently reserved for a user.
    Useful for displaying "available vs reserved" balance.
    
    Returns:
        reserved_amount: int
    """
    try:
        db = firestore.client()
        
        # Get all active reservations for user
        reservations_query = db.collection('reservations')\
            .where('userId', '==', user_id)\
            .where('status', '==', 'reserved')
        
        reservations = reservations_query.get()
        
        total_reserved = sum(r.to_dict().get('amount', 0) for r in reservations)
        return total_reserved
        
    except Exception as e:
        logger.error(f"Error getting reserved credits for user {user_id}: {e}")
        return 0
