"""
Payments Routes
Handles credit purchases via simulated payment gateway.
For Real Implementation:
1. Replace simulated success with Stripe/JazzCash API calls.
2. Use Webhooks for credit addition upon payment confirmation.
"""
from flask import Blueprint, request, jsonify
import logging

from services.credit_service import add_credits
from services.idempotency_service import check_idempotency, store_idempotency

logger = logging.getLogger(__name__)

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payments_bp.route('/initiate', methods=['POST'])
def initiate_payment():
    """
    Initiate and Process Payment with Idempotency Protection.
    In production, this would return a Stripe Checkout session ID or JazzCash redirect URL.
    """
    try:
        # ===== IDEMPOTENCY CHECK =====
        idempotency_key = request.headers.get('Idempotency-Key')
        if not idempotency_key:
            return jsonify({'success': False, 'error': 'Idempotency-Key header required'}), 400
        
        data = request.json
        user_id = data.get('user_id')
        plan_id = data.get('plan_id')
        payment_method = data.get('payment_method', 'mock')  # 'jazzcash' | 'easypaisa' | 'card'
        phone_number = data.get('phone_number', '')
        is_mock = data.get('mock', False)  # Flag for mock payment
        
        if not user_id or not plan_id:
            return jsonify({'success': False, 'error': 'Missing user_id or plan_id'}), 400
        
        # Validate phone number for mock payments
        if is_mock and payment_method in ['jazzcash', 'easypaisa']:
            if not phone_number or len(phone_number) < 11:
                error_response = {'success': False, 'error': 'Invalid phone number'}
                store_idempotency(idempotency_key, user_id, 'payment', error_response, status='failed')
                return jsonify(error_response), 400
        
        # Check if this request was already processed
        existing_response = check_idempotency(idempotency_key, user_id, 'payment')
        if existing_response:
            logger.info(f"Duplicate payment request detected for key {idempotency_key}, returning cached response")
            return jsonify(existing_response), 200
        
        # Store processing status immediately
        store_idempotency(idempotency_key, user_id, 'payment', {'status': 'processing'}, status='processing')
            
        # Define Plans (Should be in DB/Config really)
        PLANS = {
            'silver': 50,
            'golden': 200,
            'platinum': 1000
        }
        
        credits = PLANS.get(plan_id)
        if not credits:
            error_response = {'success': False, 'error': 'Invalid Plan'}
            store_idempotency(idempotency_key, user_id, 'payment', error_response, status='failed')
            return jsonify(error_response), 400
        
        # ===== MOCK PAYMENT MODE =====
        if is_mock:
            logger.info(f"Mock payment for {user_id} - Plan: {plan_id}, Method: {payment_method}, Phone: {phone_number}")
            
            # Simulate payment processing delay (realistic UX)
            import time
            time.sleep(1)  # 1 second delay
            
            # Add Credits (now returns transaction_id)
            success, transaction_id_or_error = add_credits(
                user_id, 
                credits, 
                f"Mock {payment_method.upper()} - {plan_id.title()} Plan",
                type='purchase',
                metadata={
                    'plan_id': plan_id,
                    'payment_method': payment_method,
                    'phone_number': phone_number,
                    'idempotency_key': idempotency_key,
                    'mock': True
                }
            )
            
            if success:
                success_response = {
                    'success': True, 
                    'message': 'Mock payment successful', 
                    'credits_added': credits,
                    'transaction_id': transaction_id_or_error,
                    'payment_method': payment_method
                }
                # Store successful response for 60 seconds
                store_idempotency(idempotency_key, user_id, 'payment', success_response, status='completed')
                return jsonify(success_response)
            else:
                error_response = {'success': False, 'error': transaction_id_or_error}
                store_idempotency(idempotency_key, user_id, 'payment', error_response, status='failed')
                return jsonify(error_response), 500
        
        # ===== REAL PAYMENT MODE (Not implemented yet) =====
        else:
            # TODO: Integrate real payment gateways
            # For now, return error
            error_response = {'success': False, 'error': 'Real payment integration not yet implemented. Please use mock mode.'}
            store_idempotency(idempotency_key, user_id, 'payment', error_response, status='failed')
            return jsonify(error_response), 501  # Not Implemented
            
    except Exception as e:
        logger.error(f"Payment error: {e}", exc_info=True)
        error_response = {'success': False, 'error': str(e)}
        # Try to store error response
        try:
            if 'idempotency_key' in locals() and 'user_id' in locals():
                store_idempotency(idempotency_key, user_id, 'payment', error_response, status='failed')
        except:
            pass
        return jsonify(error_response), 500
