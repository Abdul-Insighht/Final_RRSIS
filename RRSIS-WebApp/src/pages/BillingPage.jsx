import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTransactionHistory } from '../firebase/firestore';
import PaymentModal from '../components/common/PaymentModal';

const BillingPage = () => {
    const { user, userProfile } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (user?.uid) {
                try {
                    const history = await getTransactionHistory(user.uid);
                    setTransactions(history);
                } catch (error) {
                    console.error("Error fetching transactions:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetchHistory();
    }, [user, userProfile?.credits]); // Re-fetch when credits change (after payment)

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        // Handle Firestore Timestamp
        if (timestamp.toDate) return timestamp.toDate().toLocaleString();
        // Handle Date object or string
        return new Date(timestamp).toLocaleString();
    };

    const getAmountColor = (type, amount) => {
        if (type === 'bonus' || type === 'purchase' || type === 'admin_adjustment_add' || amount > 0) return 'text-green-500';
        return 'text-red-500';
    };

    const getTypeLabel = (type) => {
        const labels = {
            'purchase': 'Purchase',
            'usage': 'Usage',
            'bonus': 'Bonus',
            'admin_adjustment_add': 'Admin Add',
            'admin_adjustment_deduct': 'Admin Deduct',
            'refund': 'Refund'
        };
        return labels[type] || type;
    };

    const getPaymentMethodLogo = (method) => {
        if (method === 'jazzcash') {
            return (
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                            <linearGradient id="jazzGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#FF6B00', stopOpacity: 1 }} />
                                <stop offset="100%" style={{ stopColor: '#E63900', stopOpacity: 1 }} />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="url(#jazzGradient)" />
                        <text x="50" y="60" fontSize="32" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial">JC</text>
                    </svg>
                </div>
            );
        }

        if (method === 'easypaisa') {
            return (
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                            <linearGradient id="epGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#00A651', stopOpacity: 1 }} />
                                <stop offset="100%" style={{ stopColor: '#008C3E', stopOpacity: 1 }} />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="url(#epGradient)" />
                        <text x="50" y="60" fontSize="28" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial">EP</text>
                    </svg>
                </div>
            );
        }

        if (method === 'admin') {
            return (
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                            <linearGradient id="adminGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                                <stop offset="100%" style={{ stopColor: '#6366F1', stopOpacity: 1 }} />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="url(#adminGradient)" />
                        <text x="50" y="60" fontSize="32" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial">A</text>
                    </svg>
                </div>
            );
        }

        // Fallback
        return (
            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                <span className="text-white font-bold text-sm">💰</span>
            </div>
        );
    };

    const getPurchaseAmount = (tx) => {
        // Map plan_id to price
        const planPrices = {
            'silver': 500,
            'golden': 1800,
            'platinum': 8000
        };

        // Get amount from metadata if available
        if (tx.metadata?.plan_id) {
            return planPrices[tx.metadata.plan_id] || '-';
        }
        return '-';
    };

    return (
        <div className="p-4 md:p-8 bg-background-dark min-h-screen">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Billing & Credits</h1>
                        <p className="text-text-muted">Manage your subscription and credit usage</p>
                    </div>
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-primary hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Buy Credits
                    </button>
                </div>

                {/* Current Balance Card */}
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-6 md:p-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-muted text-sm mb-2">Current Balance</p>
                            <h2 className="text-5xl font-black text-white mb-1">{userProfile?.credits || 0}</h2>
                            <p className="text-primary font-bold">Credits Available</p>
                        </div>
                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-5xl">account_balance_wallet</span>
                        </div>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border-dark">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Transaction History
                        </h3>
                    </div>

                    {isLoading ? (
                        <div className="p-12 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center text-text-muted">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">receipt_long</span>
                            <p>No transactions found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Payment Details</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Credits</th>
                                        <th className="px-6 py-4 text-right">Total Credits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark text-slate-300">
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-text-muted">
                                                {formatTimestamp(tx.timestamp)}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">
                                                {tx.description}
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Admin transactions */}
                                                {(tx.type === 'admin_adjustment_add' || tx.type === 'admin_adjustment_deduct') && (
                                                    <div className="flex items-center gap-2">
                                                        {getPaymentMethodLogo('admin')}
                                                        <div>
                                                            <p className="text-white font-medium">Admin</p>
                                                            {tx.metadata?.admin_email && (
                                                                <p className="text-text-muted text-xs font-mono">
                                                                    {tx.metadata.admin_email}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Payment method transactions (JazzCash, Easypaisa) */}
                                                {tx.metadata?.payment_method && tx.type !== 'admin_adjustment_add' && tx.type !== 'admin_adjustment_deduct' && (
                                                    <div className="flex items-center gap-2">
                                                        {getPaymentMethodLogo(tx.metadata.payment_method)}
                                                        <div>
                                                            <p className="text-white font-medium capitalize">
                                                                {tx.metadata.payment_method}
                                                            </p>
                                                            {tx.metadata.phone_number && (
                                                                <p className="text-text-muted text-xs font-mono">
                                                                    {tx.metadata.phone_number}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* No payment details */}
                                                {!tx.metadata?.payment_method && tx.type !== 'admin_adjustment_add' && tx.type !== 'admin_adjustment_deduct' && (
                                                    <span className="text-text-muted text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 capitalize">
                                                <span className={`px-2 py-1 rounded text-xs ${tx.type === 'purchase' || tx.type === 'bonus' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                    tx.type === 'usage' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                                        'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                                    }`}>
                                                    {getTypeLabel(tx.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-white">
                                                {tx.type === 'purchase' ? (
                                                    <span>Rs {getPurchaseAmount(tx)}</span>
                                                ) : (
                                                    <span className="text-text-muted text-xs">-</span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${getAmountColor(tx.type, tx.amount)}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {tx.balanceAfter !== undefined ? (
                                                    <span className="text-white font-bold">{tx.balanceAfter}</span>
                                                ) : (
                                                    <span className="text-text-muted text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
            />
        </div>
    );
};

export default BillingPage;
