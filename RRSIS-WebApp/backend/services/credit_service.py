"""
Credit Service
Handles credit balance checks and deductions for backend operations.
"""
import logging
import firebase_admin
from firebase_admin import firestore
from datetime import datetime

logger = logging.getLogger(__name__)

def get_user_balance(user_id):
    """Get current credit balance."""
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(user_id)
        doc = user_ref.get()
        if doc.exists:
            return doc.to_dict().get('credits', 0)
        return 0
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        return 0

def deduct_credits(user_id, amount, description, transaction_type='usage', metadata=None):
    """
    Deduct credits from user.
    Returns: (success, message_or_new_balance)
    """
    db = firestore.client()
    user_ref = db.collection('users').document(user_id)

    @firestore.transactional
    def update_in_transaction(transaction, user_ref):
        snapshot = user_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise ValueError("User not found")
            
        current_credits = snapshot.to_dict().get('credits', 0)
        
        if current_credits < amount:
            raise ValueError(f"Insufficient credits. Required: {amount}, Available: {current_credits}")
            
        new_credits = current_credits - amount
        transaction.update(user_ref, {'credits': new_credits})
        
        # Log transaction
        trans_ref = db.collection('transactions').document()
        transaction_id = trans_ref.id
        transaction.set(trans_ref, {
            'id': transaction_id,
            'userId': user_id,
            'type': transaction_type,
            'amount': -amount,
            'description': description,
            'balanceBefore': current_credits,
            'balanceAfter': new_credits,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'metadata': metadata or {}
        })
        return new_credits

    transaction = db.transaction()
    try:
        new_balance = update_in_transaction(transaction, user_ref)
        logger.info(f"Deducted {amount} credits from {user_id}. New balance: {new_balance}")
        return True, new_balance
    except ValueError as val_err:
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Transaction failed: {e}")
        return False, "Transaction failed"


def add_credits(user_id, amount, description, type='purchase', metadata=None):
    """
    Add credits to user using atomic transaction.
    
    Args:
        user_id: User ID
        amount: Credits to add
        description: Transaction description
        type: Transaction type
        metadata: Optional metadata dict
    
    Returns:
        (success: bool, transaction_id: str | error_message: str)
    """
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(user_id)
        
        @firestore.transactional
        def add_in_transaction(transaction, user_ref):
            # Read current balance
            snapshot = user_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise ValueError("User not found")
            
            current_credits = snapshot.to_dict().get('credits', 0)
            new_credits = current_credits + amount
            
            # Update user balance
            transaction.update(user_ref, {'credits': new_credits})
            
            # Create transaction record
            trans_ref = db.collection('transactions').document()
            transaction_id = trans_ref.id
            transaction.set(trans_ref, {
                'id': transaction_id,
                'userId': user_id,
                'type': type,
                'amount': amount,
                'status': 'completed',
                'description': description,
                'balanceBefore': current_credits,
                'balanceAfter': new_credits,
                'reservationId': None,
                'reversedBy': None,
                'reversalReason': None,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'metadata': metadata or {}
            })
            
            return transaction_id, new_credits
        
        transaction = db.transaction()
        transaction_id, new_balance = add_in_transaction(transaction, user_ref)
        
        logger.info(f"Added {amount} credits to {user_id}. Transaction: {transaction_id}, New balance: {new_balance}")
        return True, transaction_id
        
    except ValueError as val_err:
        logger.error(f"Add credits failed for {user_id}: {val_err}")
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Add credits failed for {user_id}: {e}", exc_info=True)
        return False, "Credit addition failed due to system error"


def reverse_transaction(transaction_id, reason, admin_id=None):
    """
    Reverse a completed transaction (refund).
    Creates a new refund transaction and restores credits.
    
    Args:
        transaction_id: Transaction ID to reverse
        reason: Reason for reversal
        admin_id: Admin ID if this is an admin action
    
    Returns:
        (success: bool, refund_transaction_id: str | error_message: str)
    """
    try:
        db = firestore.client()
        trans_ref = db.collection('transactions').document(transaction_id)
        
        @firestore.transactional
        def create_reversal(transaction, trans_ref):
            # Get original transaction
            trans_snap = trans_ref.get(transaction=transaction)
            if not trans_snap.exists:
                raise ValueError(f"Transaction {transaction_id} not found")
            
            original_tx = trans_snap.to_dict()
            
            # Validate transaction can be reversed
            if original_tx.get('status') == 'reversed':
                raise ValueError(f"Transaction {transaction_id} already reversed")
            
            if original_tx.get('reversedBy'):
                raise ValueError(f"Transaction {transaction_id} already has a reversal")
            
            # Calculate refund amount (opposite of original)
            refund_amount = -original_tx['amount']
            user_id = original_tx['userId']
            
            # Update user balance
            user_ref = db.collection('users').document(user_id)
            user_snap = user_ref.get(transaction=transaction)
            if not user_snap.exists:
                raise ValueError(f"User {user_id} not found")
            
            current_credits = user_snap.to_dict().get('credits', 0)
            new_credits = current_credits + refund_amount
            
            if new_credits < 0:
                logger.warning(f"Reversal would result in negative balance for user {user_id}: {new_credits}")
                # Allow it anyway for admin corrections
            
            transaction.update(user_ref, {'credits': new_credits})
            
            # Create refund transaction
            refund_ref = db.collection('transactions').document()
            refund_id = refund_ref.id
            
            refund_description = f"Refund: {original_tx.get('description', 'N/A')} | Reason: {reason}"
            if admin_id:
                refund_description = f"[Admin {admin_id}] {refund_description}"
            
            transaction.set(refund_ref, {
                'id': refund_id,
                'userId': user_id,
                'type': 'refund',
                'amount': refund_amount,
                'status': 'completed',
                'description': refund_description,
                'reservationId': original_tx.get('reservationId'),
                'reversedBy': None,
                'reversalReason': None,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'metadata': {
                    'originalTransactionId': transaction_id,
                    'reversalReason': reason,
                    'adminId': admin_id
                }
            })
            
            # Mark original transaction as reversed
            transaction.update(trans_ref, {
                'status': 'reversed',
                'reversedBy': refund_id,
                'reversalReason': reason
            })
            
            return refund_id, new_credits
        
        transaction = db.transaction()
        refund_id, new_balance = create_reversal(transaction, trans_ref)
        
        logger.info(f"Reversed transaction {transaction_id} → refund {refund_id}. New balance: {new_balance}")
        return True, refund_id
        
    except ValueError as val_err:
        logger.warning(f"Reversal failed for transaction {transaction_id}: {val_err}")
        return False, str(val_err)
    except Exception as e:
        logger.error(f"Reversal error for transaction {transaction_id}: {e}", exc_info=True)
        return False, "Reversal failed due to system error"
