import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    getAllModels,
    createModel,
    updateModel,
    deleteModel
} from '../../firebase/firestore_admin';

const ModelManagementPage = () => {
    const { admin, isAdmin } = useAdminAuth();
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingModel, setEditingModel] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    const fetchModels = async () => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const allModels = await getAllModels();
            setModels(allModels);
        } catch (error) {
            console.error('Error fetching models:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchModels();
    }, [isAdmin]);

    const handleCreateModel = async (modelData) => {
        try {
            await createModel(modelData, admin.uid);
            fetchModels();
            setShowAddModal(false);
        } catch (error) {
            console.error('Error creating model:', error);
        }
    };

    const handleUpdateModel = async (modelId, updates) => {
        try {
            await updateModel(modelId, updates, admin.uid);
            fetchModels();
            setEditingModel(null);
        } catch (error) {
            console.error('Error updating model:', error);
        }
    };

    const handleToggleStatus = async (modelId, currentStatus) => {
        const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
        try {
            await updateModel(modelId, { status: newStatus }, admin.uid);
            fetchModels();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const handleDeleteModel = async (modelId) => {
        try {
            await deleteModel(modelId, admin.uid);
            fetchModels();
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting model:', error);
        }
    };

    const ModelForm = ({ model, onSubmit, onCancel }) => {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    onSubmit({
                        name: formData.get('name'),
                        description: formData.get('description'),
                        version: formData.get('version'),
                        status: formData.get('status'),
                    });
                }}
                className="flex flex-col gap-4"
            >
                <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Model Name</label>
                    <input
                        type="text"
                        name="name"
                        defaultValue={model?.name}
                        placeholder="e.g., CADFormer v2"
                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Description</label>
                    <textarea
                        name="description"
                        defaultValue={model?.description}
                        placeholder="Model description..."
                        rows={3}
                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm p-3"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Version</label>
                    <input
                        type="text"
                        name="version"
                        defaultValue={model?.version}
                        placeholder="e.g., 1.0"
                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Status</label>
                    <select
                        name="status"
                        defaultValue={model?.status || 'enabled'}
                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white focus:border-primary focus:ring-primary text-sm h-10 px-4"
                    >
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </div>
                <div className="flex gap-3 mt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-medium transition-colors"
                    >
                        {model ? 'Update Model' : 'Add Model'}
                    </button>
                </div>
            </form>
        );
    };

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Model Management</h1>
                        <p className="text-text-muted">Configure segmentation models available to users</p>
                    </div>
                </div>

                {/* Models Table */}
                <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                        </div>
                    ) : models.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                            No models configured
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Model Name</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Version</th>
                                        <th className="px-6 py-4">Integration</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark text-slate-300">
                                    {models.map((model) => (
                                        <tr key={model.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{model.name}</td>
                                            <td className="px-6 py-4 max-w-xs truncate">{model.description}</td>
                                            <td className="px-6 py-4">{model.version}</td>
                                            <td className="px-6 py-4">
                                                {model.isIntegrated ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        <span className="material-symbols-outlined text-xs">code</span>
                                                        Integrated
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                        <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                                                        Code Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {model.status === 'enabled' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                                        Enabled
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                                                        Disabled
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingModel(model)}
                                                        className="p-2 hover:bg-white/10 rounded text-sky-blue transition-colors"
                                                        title="Edit model"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(model.id, model.status)}
                                                        className={`p-2 hover:bg-white/10 rounded transition-colors ${model.status === 'enabled' ? 'text-yellow-500' : 'text-green-500'}`}
                                                        title={model.status === 'enabled' ? 'Disable' : 'Enable'}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">
                                                            {model.status === 'enabled' ? 'toggle_on' : 'toggle_off'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(model)}
                                                        className="p-2 hover:bg-white/10 rounded text-red-500 transition-colors"
                                                        title="Delete model"
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

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Add New Model</h3>
                            <ModelForm
                                onSubmit={handleCreateModel}
                                onCancel={() => setShowAddModal(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingModel && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Edit Model</h3>
                            <ModelForm
                                model={editingModel}
                                onSubmit={(data) => handleUpdateModel(editingModel.id, data)}
                                onCancel={() => setEditingModel(null)}
                            />
                        </div>
                    </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Delete Model</h3>
                            <p className="text-text-muted mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">{showDeleteConfirm.name}</span>? This will remove it from the user's model selection.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteModel(showDeleteConfirm.id)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                >
                                    Delete Model
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelManagementPage;
