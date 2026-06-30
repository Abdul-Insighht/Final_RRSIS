import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';

const CreditAdjustmentModal = ({ isOpen, onClose, user, onUpdate }) => {
    const { token } = useAdminAuth();
    const [activeTab, setActiveTab] = useState('adjust'); // 'adjust' or 'history'

    // Form state
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('add');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // History state
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setAmount('');
            setType('add');
            setReason('');
            setError('');
            setSuccessMsg('');
            setActiveTab('adjust');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeTab === 'history' && user) {
            fetchHistory();
        }
    }, [isOpen, activeTab, user]);

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setHistory(data.transactions || []);
            } else {
                console.error('Failed to fetch history:', data.error);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsSubmitting(true);

        try {
            const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}/credits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: parseInt(amount),
                    type,
                    reason
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMsg(`Successfully ${type === 'add' ? 'added' : 'deducted'} ${amount} credits.`);
                setAmount('');
                setReason('');
                if (onUpdate) onUpdate(user.id);
                // Optionally refresh history if tab changes later
            } else {
                setError(data.error || 'Operation failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-dark rounded-xl border border-border-dark w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-border-dark flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Manage Credits</h3>
                        <p className="text-text-muted text-sm">User: <span className="text-white font-medium">{user.name}</span> ({user.email})</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-dark px-6">
                    <button
                        onClick={() => setActiveTab('adjust')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'adjust'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-white'
                            }`}
                    >
                        Adjust Credits
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-white'
                            }`}
                    >
                        Transaction History
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'adjust' ? (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md mx-auto">
                            <div className="bg-white/5 p-4 rounded-lg text-center mb-2">
                                <p className="text-text-muted mb-1">Current Credits</p>
                                <h2 className="text-3xl font-bold text-white">{user.credits || 0}</h2>
                            </div>

                            {successMsg && (
                                <div className="p-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-sm text-center">
                                    {successMsg}
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="flex bg-input-bg-dark rounded-lg p-1 border border-border-dark">
                                <button
                                    type="button"
                                    onClick={() => setType('add')}
                                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors ${type === 'add' ? 'bg-primary text-white shadow' : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    Add Credits
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('deduct')}
                                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors ${type === 'deduct' ? 'bg-red-500 text-white shadow' : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    Deduct Credits
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Credits</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white p-2.5 focus:border-primary focus:ring-1 focus:ring-primary"
                                    placeholder="Enter credits"
                                    min="1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Reason (Required)</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white p-2.5 focus:border-primary focus:ring-1 focus:ring-primary min-h-[80px]"
                                    placeholder="Explain why you are adjusting credits..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`mt-2 py-2.5 rounded-lg font-bold text-white transition-all shadow-lg ${type === 'add'
                                    ? 'bg-primary hover:bg-green-600 shadow-primary/20'
                                    : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                    } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                            >
                                {isSubmitting && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                                {type === 'add' ? 'Add Credits' : 'Deduct Credits'}
                            </button>
                        </form>
                    ) : (
                        <div className="h-full">
                            {isLoadingHistory ? (
                                <div className="flex justify-center py-12">
                                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12 text-text-muted">
                                    No history available.
                                </div>
                            ) : (
                                <div className="overflow-auto max-h-[400px]">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 bg-surface-dark text-text-muted text-xs uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-3">Time</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 text-right">Credits</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-dark">
                                            {history.map((tx, idx) => (
                                                <tr key={idx} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                                                        {new Date(tx.timestamp).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 capitalize">{tx.type}</td>
                                                    <td className="px-4 py-3">{tx.description}</td>
                                                    <td className={`px-4 py-3 text-right font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreditAdjustmentModal;
