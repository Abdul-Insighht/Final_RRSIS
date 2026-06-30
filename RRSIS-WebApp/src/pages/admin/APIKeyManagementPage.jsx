import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { auth } from '../../firebase/config';
import {
    getAllApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey
} from '../../firebase/firestore';

const APIKeyManagementPage = () => {
    const { isAdmin } = useAdminAuth();
    const [apiKeys, setApiKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newKeyData, setNewKeyData] = useState(null);

    const fetchAPIKeys = async () => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const allKeys = await getAllApiKeys();
            setApiKeys(allKeys);
        } catch (error) {
            console.error('Error fetching API keys:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAPIKeys();
    }, [isAdmin]);

    const handleCreateKey = async (name) => {
        try {
            const newKey = await createApiKey({ name }, auth.currentUser?.uid);
            setNewKeyData(newKey);
            fetchAPIKeys();
            setShowAddModal(false);
        } catch (error) {
            console.error('Error creating API key:', error);
        }
    };

    const handleRevokeKey = async (keyId) => {
        try {
            await revokeApiKey(keyId);
            fetchAPIKeys();
        } catch (error) {
            console.error('Error revoking API key:', error);
        }
    };

    const handleDeleteKey = async (keyId) => {
        try {
            await deleteApiKey(keyId);
            fetchAPIKeys();
        } catch (error) {
            console.error('Error deleting API key:', error);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">API Key Management</h1>
                        <p className="text-text-muted">Manage API keys for system access</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Create API Key
                    </button>
                </div>

                {newKeyData && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-green-500 mt-0.5">check_circle</span>
                            <div className="flex-1">
                                <p className="text-green-500 font-medium mb-2">API Key Created Successfully!</p>
                                <p className="text-sm text-text-muted mb-2">Save this key - it will not be shown again:</p>
                                <div className="bg-black/30 rounded p-3 font-mono text-sm text-white break-all">
                                    {newKeyData.key}
                                </div>
                                <button
                                    onClick={() => setNewKeyData(null)}
                                    className="mt-3 text-sm text-green-500 hover:underline"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                        </div>
                    ) : apiKeys.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                            No API keys created yet
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Key</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Created</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark text-slate-300">
                                    {apiKeys.map((apiKey) => (
                                        <tr key={apiKey.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{apiKey.name}</td>
                                            <td className="px-6 py-4 font-mono text-xs">{apiKey.key}</td>
                                            <td className="px-6 py-4">
                                                {apiKey.status === 'active' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                                        Revoked
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">{new Date(apiKey.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {apiKey.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRevokeKey(apiKey.id)}
                                                            className="p-2 hover:bg-white/10 rounded text-yellow-500 transition-colors"
                                                            title="Revoke key"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">block</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteKey(apiKey.id)}
                                                        className="p-2 hover:bg-white/10 rounded text-red-500 transition-colors"
                                                        title="Delete key"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Create API Key</h3>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    handleCreateKey(formData.get('name'));
                                }}
                                className="flex flex-col gap-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5">Key Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="e.g., Production API Key"
                                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                        required
                                    />
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-medium transition-colors"
                                    >
                                        Create Key
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default APIKeyManagementPage;
