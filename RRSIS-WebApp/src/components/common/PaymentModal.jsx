import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const PLANS = [
    {
        id: 'silver',
        name: 'Silver',
        credits: 50,
        price: '500',
        pricePerCredit: 10,
        color: 'text-slate-300',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30'
    },
    {
        id: 'golden',
        name: 'Golden',
        credits: 200,
        price: '1800',
        pricePerCredit: 9,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        popular: true
    },
    {
        id: 'platinum',
        name: 'Platinum',
        credits: 1000,
        price: '8000',
        pricePerCredit: 8,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30'
    }
];

const PAYMENT_METHODS = [
    {
        id: 'jazzcash',
        name: 'JazzCash',
        icon: '📱',
        description: 'Pay via JazzCash Mobile Wallet',
        color: 'from-red-500 to-orange-500',
        recommended: true
    },
    {
        id: 'easypaisa',
        name: 'Easypaisa',
        icon: '💳',
        description: 'Pay via Easypaisa Mobile Account',
        color: 'from-green-500 to-emerald-500',
        recommended: false
    }
];

const PaymentModal = ({ isOpen, onClose }) => {
    const { user, userProfile } = useAuth();
    const [step, setStep] = useState('plan'); // 'plan' | 'method' | 'payment' | 'processing' | 'success' | 'error'
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const handlePlanSelect = (plan) => {
        setSelectedPlan(plan);
        setStep('method');
    };

    const handleMethodSelect = (method) => {
        setSelectedMethod(method);
        setStep('payment');
    };

    const handlePayment = async () => {
        // Validate phone number
        if (!phoneNumber || phoneNumber.length < 11) {
            setErrorMessage('Please enter a valid 11-digit phone number');
            return;
        }

        setIsProcessing(true);
        setErrorMessage('');
        setStep('processing');

        try {
            // Generate idempotency key
            const idempotencyKey = `payment_${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Call Backend API with mock payment
            const response = await fetch('http://localhost:5000/api/payments/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify({
                    user_id: user.uid,
                    plan_id: selectedPlan.id,
                    payment_method: selectedMethod.id,
                    phone_number: phoneNumber,
                    mock: true  // Flag for mock payment
                })
            });

            const result = await response.json();

            if (result.success) {
                setStep('success');

                // Wait for Firestore sync then close
                setTimeout(() => {
                    onClose();
                    resetModal();
                }, 3000);
            } else {
                setErrorMessage(result.error || 'Payment failed');
                setStep('error');
            }
        } catch (error) {
            console.error('Payment error:', error);
            setErrorMessage(error.message || 'Network error occurred');
            setStep('error');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetModal = () => {
        setStep('plan');
        setSelectedPlan(null);
        setSelectedMethod(null);
        setPhoneNumber('');
        setErrorMessage('');
    };

    const handleBack = () => {
        if (step === 'method') {
            setStep('plan');
            setSelectedPlan(null);
        } else if (step === 'payment') {
            setStep('method');
            setSelectedMethod(null);
            setPhoneNumber('');
            setErrorMessage('');
        }
    };

    const handleClose = () => {
        if (step !== 'processing') {
            onClose();
            setTimeout(resetModal, 300);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-surface-dark border border-border-dark w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-border-dark flex justify-between items-center bg-background-dark/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {step === 'plan' && 'Top Up Credits'}
                            {step === 'method' && 'Select Payment Method'}
                            {step === 'payment' && `Pay with ${selectedMethod?.name}`}
                            {step === 'processing' && 'Processing Payment'}
                            {step === 'success' && 'Payment Successful'}
                            {step === 'error' && 'Payment Failed'}
                        </h2>
                        <p className="text-text-muted text-sm mt-1">
                            Current Balance: <span className="text-primary font-bold">{userProfile?.credits || 0} Credits</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(step === 'method' || step === 'payment') && (
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            disabled={step === 'processing'}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {/* Step 1: Plan Selection */}
                    {step === 'plan' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-xl border ${plan.border} ${plan.bg} p-6 flex flex-col transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer group`}
                                    onClick={() => handlePlanSelect(plan)}
                                >
                                    {plan.popular && (
                                        <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                                            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                                                Best Value
                                            </span>
                                        </div>
                                    )}
                                    {plan.savings && (
                                        <div className="absolute top-4 left-4">
                                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                                {plan.savings}
                                            </span>
                                        </div>
                                    )}

                                    <h3 className={`text-xl font-bold ${plan.color} mb-2`}>{plan.name}</h3>
                                    <div className="mb-4">
                                        <span className="text-4xl font-black text-white">{plan.credits}</span>
                                        <span className={`text-sm ml-2 ${plan.color} opacity-80`}>Credits</span>
                                    </div>

                                    <div className="py-4 border-t border-white/10 mb-6">
                                        <div className="text-3xl font-bold text-white">Rs {plan.price}</div>
                                        <div className="text-xs text-text-muted mt-1">Rs {plan.pricePerCredit}/credit</div>
                                    </div>

                                    <ul className="space-y-3 mb-8 flex-1">
                                        <li className="flex items-center gap-2 text-sm text-slate-300">
                                            <span className="material-symbols-outlined text-primary text-base">check</span>
                                            Valid for lifetime
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-slate-300">
                                            <span className="material-symbols-outlined text-primary text-base">check</span>
                                            Instant activation
                                        </li>
                                    </ul>

                                    <button
                                        className="w-full py-3 rounded-lg font-bold text-sm transition-all bg-white text-black hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20"
                                    >
                                        Select Plan
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Payment Method Selection */}
                    {step === 'method' && (
                        <div className="max-w-2xl mx-auto">
                            <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-bold">{selectedPlan.name} Plan</p>
                                        <p className="text-text-muted text-sm">{selectedPlan.credits} Credits</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-white">Rs {selectedPlan.price}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {PAYMENT_METHODS.map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => handleMethodSelect(method)}
                                        className="w-full p-6 border border-border-dark rounded-xl hover:border-primary transition-all text-left group bg-surface-dark/50 hover:bg-surface-dark"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${method.color} flex items-center justify-center text-3xl`}>
                                                {method.icon}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                                    {method.name}
                                                    {method.recommended && (
                                                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                                            Recommended
                                                        </span>
                                                    )}
                                                </h3>
                                                <p className="text-text-muted text-sm">{method.description}</p>
                                            </div>
                                            <span className="material-symbols-outlined text-text-muted group-hover:text-primary text-3xl">
                                                arrow_forward
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment Details */}
                    {step === 'payment' && (
                        <div className="max-w-md mx-auto">
                            <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-text-muted text-sm">Plan</p>
                                    <p className="text-white font-bold">{selectedPlan.name}</p>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-text-muted text-sm">Credits</p>
                                    <p className="text-white">{selectedPlan.credits}</p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                    <p className="text-white font-bold">Total Amount</p>
                                    <p className="text-2xl font-bold text-primary">Rs {selectedPlan.price}</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-white font-bold mb-2">
                                    {selectedMethod.name} Number
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    placeholder="03XXXXXXXXX"
                                    className="w-full px-4 py-3 bg-background-dark border border-border-dark rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
                                    maxLength="11"
                                />
                                {errorMessage && (
                                    <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
                                )}
                                <p className="text-text-muted text-xs mt-2">
                                    Enter your 11-digit {selectedMethod.name} mobile number
                                </p>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={isProcessing || !phoneNumber || phoneNumber.length < 11}
                                className="w-full py-4 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">payment</span>
                                Pay Rs {selectedPlan.price}
                            </button>
                        </div>
                    )}

                    {/* Step 4: Processing */}
                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                            <h3 className="text-2xl font-bold text-white mb-2">Processing Payment</h3>
                            <p className="text-text-muted">Please wait while we verify your payment...</p>
                            <p className="text-text-muted text-sm mt-2">Do not close this window</p>
                        </div>
                    )}

                    {/* Step 5: Success */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-5xl">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                            <p className="text-text-muted mb-2">{selectedPlan.credits} credits have been added to your account.</p>
                            <p className="text-text-muted text-sm">Balance will update in a moment...</p>
                        </div>
                    )}

                    {/* Step 6: Error */}
                    {step === 'error' && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-5xl">error</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Payment Failed</h3>
                            <p className="text-text-muted mb-4">{errorMessage || 'An error occurred during payment processing.'}</p>
                            <button
                                onClick={() => setStep('payment')}
                                className="bg-primary hover:bg-green-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-dark bg-background-dark/50 flex justify-between items-center text-xs text-text-muted">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">lock</span> Secure Payment</span>
                        <span>•</span>
                        <span>JazzCash / Easypaisa</span>
                    </div>
                    {step === 'plan' && (
                        <span className="text-primary">Select a plan to continue</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
