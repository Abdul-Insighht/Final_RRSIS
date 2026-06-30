import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createProject, getNextProjectNumber } from '../firebase/firestore';

const ProjectNameModal = ({ isOpen, onClose, imageData, onProjectCreated }) => {
    const [projectName, setProjectName] = useState('');
    const [selectedModel, setSelectedModel] = useState('cadformer');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();

    // Available models - same as NewSegmentationPage
    const models = [
        { value: 'cadformer', label: 'CADFormer (Context-Aware)' },
        { value: 'rs-ot-sam3', label: 'RS-OT-SAM3' },
    ];

    // Auto-suggest project name when modal opens
    useEffect(() => {
        if (isOpen && user) {
            const suggestProjectName = async () => {
                try {
                    const nextNumber = await getNextProjectNumber(user.uid);
                    setProjectName(`Untitled Project ${nextNumber}`);
                } catch (err) {
                    console.error('Error getting project number:', err);
                    setProjectName('Untitled Project 1');
                }
            };
            suggestProjectName();
            // Reset model selection when modal opens
            setSelectedModel('cadformer');
        }
    }, [isOpen, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        const trimmedName = projectName.trim();
        if (!trimmedName) {
            setError('Project name cannot be empty');
            return;
        }

        if (trimmedName.length > 100) {
            setError('Project name must be less than 100 characters');
            return;
        }

        if (!selectedModel) {
            setError('Please select a segmentation model');
            return;
        }

        setIsLoading(true);

        try {
            // Get model label for display
            const modelLabel = models.find(m => m.value === selectedModel)?.label || selectedModel;

            // Create project in Firestore with model info
            const project = await createProject(user.uid, {
                name: trimmedName,
                imageUrl: imageData?.url || '',
                imageName: imageData?.name || '',
                modelId: selectedModel,
                modelName: modelLabel
            });

            console.log('DEBUG: Created project with model', project.id, selectedModel);

            // Notify parent
            if (onProjectCreated) {
                onProjectCreated(project.id);
            }

            onClose();
        } catch (err) {
            console.error('Error creating project:', err);
            if (err.message && err.message.includes('Insufficient credits')) {
                setError(err.message);
                setTimeout(() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('OPEN_PAYMENT_MODAL'));
                }, 1500);
            } else {
                setError('Failed to create project. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setProjectName('');
        setSelectedModel('cadformer');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/30 backdrop-blur-md transition-all duration-300">
            <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fadeIn transform scale-100 transition-all">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border-dark flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">edit_document</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Create Project</h2>
                        <p className="text-sm text-text-muted">
                            Give your project a name to get started
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label htmlFor="projectName" className="block text-sm font-bold text-gray-200 mb-2">
                            Project Name
                        </label>
                        <input
                            type="text"
                            id="projectName"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full px-4 py-3 bg-input-bg-dark border border-border-dark rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                            placeholder="Enter project name"
                            maxLength={100}
                            autoFocus
                        />
                        <div className="flex justify-between mt-2">
                            <p className="text-xs text-text-muted">
                                This will be your project's identifier
                            </p>
                            <p className="text-xs text-text-muted">
                                {projectName.length}/100
                            </p>
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className="mb-6">
                        <label htmlFor="modelSelect" className="block text-sm font-bold text-gray-200 mb-2">
                            Segmentation Model <span className="text-xs text-yellow-400 ml-1">(locked after creation)</span>
                        </label>
                        <select
                            id="modelSelect"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full px-4 py-3 bg-input-bg-dark border border-border-dark rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium appearance-none cursor-pointer"
                        >
                            {models.map((model) => (
                                <option key={model.value} value={model.value}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-text-muted mt-2">
                            This model will be used for all queries in this project
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
                            <span className="material-symbols-outlined text-sm">error</span>
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Image Info (if provided) */}
                    {imageData && (
                        <div className="mb-6 p-3 bg-black/20 rounded-lg border border-border-dark flex items-center gap-3">
                            <span className="material-symbols-outlined text-text-muted">image</span>
                            <div className="min-w-0">
                                <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Starting Image</p>
                                <p className="text-sm text-white truncate font-mono">{imageData.name}</p>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg border border-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !projectName.trim()}
                            className="flex-1 px-4 py-2.5 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <span>Start Project (5 Credits)</span>
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectNameModal;
