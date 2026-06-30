"""
Admin User Management Routes
API endpoints for managing user accounts (admin only).
"""
from flask import Blueprint, request, jsonify
import logging

from services.storage_service import get_storage
from services.admin_auth_service import admin_required, is_admin_email, get_admin_profile
from flask import g
from firebase_admin import firestore
from services.credit_service import add_credits, deduct_credits

admin_users_bp = Blueprint('admin_users', __name__, url_prefix='/api/admin/users')
logger = logging.getLogger(__name__)


@admin_users_bp.route('', methods=['GET'])
@admin_required
def list_users():
    """
    Get all users with optional search/filter.
    Query params:
    - search: search by name or email
    - status: filter by status (active/suspended)
    """
    storage = get_storage()
    users = storage.get_all_users()
    
    # Apply search filter
    search = request.args.get('search', '').lower()
    if search:
        users = [
            u for u in users
            if search in u.get('name', '').lower() or search in u.get('email', '').lower()
        ]
    
    # Apply status filter
    status = request.args.get('status')
    if status:
        users = [u for u in users if u.get('status') == status]
    
    return jsonify({'users': users})


@admin_users_bp.route('/<user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    """Get detailed information about a specific user."""
    storage = get_storage()
    user = storage.get_user_by_id(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Remove password hash
    safe_user = {k: v for k, v in user.items() if k != 'password_hash'}
    
    return jsonify({'user': safe_user})


@admin_users_bp.route('/<user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """
    Update user details.
    Request body can include: name, role, organization
    """
    storage = get_storage()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    updated_user = storage.update_user(user_id, data)
    
    if not updated_user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': updated_user
    })


@admin_users_bp.route('/<user_id>/status', methods=['PUT'])
@admin_required
def update_user_status(user_id):
    """
    Suspend or activate a user account.
    Request body: { "status": "active" | "suspended" }
    """
    storage = get_storage()
    data = request.get_json()
    
    if not data or 'status' not in data:
        return jsonify({'error': 'Status is required'}), 400
    
    status = data['status']
    if status not in ['active', 'suspended']:
        return jsonify({'error': 'Invalid status. Must be "active" or "suspended"'}), 400
    
    # Prevent admin from suspending themselves
    user = storage.get_user_by_id(user_id)
    if user and is_admin_email(user.get('email', '')):
        return jsonify({'error': 'Cannot suspend admin account'}), 403
    
    updated_user = storage.update_user_status(user_id, status)
    
    if not updated_user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': updated_user
    })


@admin_users_bp.route('/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """
    Delete a user and all their data.
    Prevents deletion of admin account.
    """
    storage = get_storage()
    
    # Prevent admin from deleting themselves
    user = storage.get_user_by_id(user_id)
    if user and is_admin_email(user.get('email', '')):
        return jsonify({'error': 'Cannot delete admin account'}), 403
    
    success = storage.delete_user(user_id)
    
    if not success:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'User deleted successfully'
    })


@admin_users_bp.route('/<user_id>/credits', methods=['POST'])
@admin_required
def adjust_user_credits(user_id):
    """
    Adjust user credits (Add/Deduct).
    Body: { amount: int, type: 'add'|'deduct', reason: str }
    """
    data = request.get_json()
    amount = data.get('amount')
    action_type = data.get('type')
    reason = data.get('reason')
    
    if not amount or str(amount).isdigit() is False or int(amount) <= 0:
        return jsonify({'error': 'Invalid amount. Must be positive integer.'}), 400
    if action_type not in ['add', 'deduct']:
        return jsonify({'error': 'Invalid type. Must be "add" or "deduct".'}), 400
    if not reason:
       return jsonify({'error': 'Reason is required for admin logs.'}), 400
    
    amount = int(amount)
    admin_email = getattr(g, 'admin_email', 'Admin')
    full_reason = f"Admin: {reason}"  # Simplified - email will be in metadata instead
    
    # Metadata for transaction
    metadata = {
        'admin_email': admin_email,
        'reason': reason
    }
    
    
    if action_type == 'add':
        success, msg = add_credits(user_id, amount, full_reason, type='admin_adjustment_add', metadata=metadata)
    else:
        success, msg = deduct_credits(user_id, amount, full_reason, transaction_type='admin_adjustment_deduct', metadata=metadata)
        
    if success:
        # Create notification for user
        from services.notification_service import create_credit_adjustment_notification
        
        print(f"\n{'='*60}")
        print(f"CREATING NOTIFICATION FOR USER: {user_id}")
        print(f"Action: {action_type}, Amount: {amount}, Reason: {reason}")
        print(f"{'='*60}\n")
        
        logger.info(f"Creating notification for user {user_id}: {action_type} {amount} credits")
        notif_success, notif_result = create_credit_adjustment_notification(
            user_id=user_id,
            action=action_type,
            amount=amount,
            reason=reason,
            admin_email=admin_email,
            transaction_id=msg  # msg contains the new balance or transaction info
        )
        
        print(f"\n{'='*60}")
        if not notif_success:
            print(f"❌ NOTIFICATION CREATION FAILED: {notif_result}")
            logger.warning(f"Failed to create notification for user {user_id}: {notif_result}")
        else:
            print(f"✅ NOTIFICATION CREATED SUCCESSFULLY: {notif_result}")
            logger.info(f"Successfully created notification {notif_result} for user {user_id}")
        print(f"{'='*60}\n")
        
        return jsonify({'success': True, 'message': 'Credits updated successfully'})
    else:
         return jsonify({'error': msg}), 400


@admin_users_bp.route('/<user_id>/transactions', methods=['GET'])
@admin_required
def get_user_transactions(user_id):
    """Get transaction history for a user."""
    try:
        db = firestore.client()
        # Note: Index might be required for ordering. If error, remove order_by or create index.
        # For now, let's try ordering.
        docs = db.collection('transactions').where('userId', '==', user_id).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(50).stream()
        
        transactions = []
        for doc in docs:
            t = doc.to_dict()
            # Convert timestamp
            if t.get('timestamp'):
                t['timestamp'] = t['timestamp'].isoformat() if hasattr(t['timestamp'], 'isoformat') else str(t['timestamp'])
            transactions.append(t)
            
        return jsonify({'transactions': transactions})
    except Exception as e:
        # Fallback if index missing
        print(f"Index error probable: {e}")
        try:
            docs = db.collection('transactions').where('userId', '==', user_id).stream()
            transactions = []
            for doc in docs:
                t = doc.to_dict()
                if t.get('timestamp'):
                    t['timestamp'] = t['timestamp'].isoformat() if hasattr(t['timestamp'], 'isoformat') else str(t['timestamp'])
                transactions.append(t)
            # Sort manually
            transactions.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            return jsonify({'transactions': transactions})
        except Exception as e2:
            return jsonify({'error': str(e2)}), 500
