import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getSystemConfig, updateSystemConfig } from '../../firebase/firestore_admin';

const SystemConfigurationPage = () => {
    const { admin, isAdmin } = useAdminAuth();
    const [config, setConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        const fetchConfig = async () => {
            if (!isAdmin) return;

            setIsLoading(true);
            try {
                const systemConfig = await getSystemConfig();
                setConfig(systemConfig);
            } catch (error) {
                console.error('Error fetching config:', error);
            }
            setIsLoading(false);
        };

        fetchConfig();
    }, [isAdmin]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveMessage('');

        const formData = new FormData(e.target);
        const updates = {
            defaultCredits: parseInt(formData.get('default_credits')),
            projectCost: parseInt(formData.get('project_cost')),
            queryCost: parseInt(formData.get('query_cost')),
            maxProjectsPerUser: parseInt(formData.get('max_projects_per_user')),
            maxQueriesPerProject: parseInt(formData.get('max_queries_per_project')),
            maxUploadSizeMB: parseInt(formData.get('max_upload_size_mb')),
        };

        try {
            await updateSystemConfig(updates, admin.uid);
            setConfig(updates);
            setSaveMessage('Configuration saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Error saving config:', error);
            setSaveMessage('Error saving configuration');
        }

        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                    <p className="text-text-muted">Loading configuration...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">System Configuration</h1>
                    <p className="text-text-muted">Manage system-wide settings and preferences</p>
                </div>

                {saveMessage && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-500">check_circle</span>
                        <p className="text-green-500 font-medium">{saveMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSave} className="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4">General Settings</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Default Credits (New Users)</label>
                                <input
                                    type="number"
                                    name="default_credits"
                                    defaultValue={config?.defaultCredits || 20}
                                    min="0"
                                    max="1000"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Project Creation Cost (Credits)</label>
                                <input
                                    type="number"
                                    name="project_cost"
                                    defaultValue={config?.projectCost || 5}
                                    min="0"
                                    max="100"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Query Execution Cost (Credits)</label>
                                <input
                                    type="number"
                                    name="query_cost"
                                    defaultValue={config?.queryCost || 1}
                                    min="0"
                                    max="100"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Max Projects Per User</label>
                                <input
                                    type="number"
                                    name="max_projects_per_user"
                                    defaultValue={config?.maxProjectsPerUser || 100}
                                    min="1"
                                    max="10000"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Max Queries Per Project</label>
                                <input
                                    type="number"
                                    name="max_queries_per_project"
                                    defaultValue={config?.maxQueriesPerProject || 1000}
                                    min="1"
                                    max="100000"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">Max Upload Size (MB)</label>
                                <input
                                    type="number"
                                    name="max_upload_size_mb"
                                    defaultValue={config?.maxUploadSizeMB || 3}
                                    min="1"
                                    max="500"
                                    className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border-dark">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SystemConfigurationPage;
