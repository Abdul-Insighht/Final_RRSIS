import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProject, getProjectQueries, deleteProject, deleteQuery, updateProject } from '../firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

const ProjectDetailPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [project, setProject] = useState(null);
    const [queries, setQueries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedQuery, setSelectedQuery] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Load project and queries
    useEffect(() => {
        const loadProjectData = async () => {
            if (!user || !projectId) {
                console.log('DEBUG: Missing user or projectId', { user: !!user, projectId });
                return;
            }

            setIsLoading(true);
            setError('');

            try {
                console.log('DEBUG: Loading project:', projectId);

                // Load project
                const projectData = await getProject(projectId);
                console.log('DEBUG: Project data:', projectData);

                if (!projectData) {
                    setError('Project not found');
                    setIsLoading(false);
                    return;
                }

                // Check if user owns this project (check both ownerId and legacy userId)
                console.log('DEBUG: Ownership check', {
                    ownerId: projectData.ownerId,
                    userId: projectData.userId,
                    currentUser: user.uid
                });

                if (projectData.ownerId !== user.uid && projectData.userId !== user.uid) {
                    setError('You do not have permission to view this project');
                    setIsLoading(false);
                    return;
                }

                setProject(projectData);

                // Load queries - in separate try/catch so project still shows even if queries fail
                try {
                    console.log('DEBUG: Loading queries for project:', projectId);
                    const queriesData = await getProjectQueries(projectId);
                    console.log('DEBUG: Queries data:', queriesData);
                    setQueries(queriesData);
                } catch (queryErr) {
                    console.error('Error loading queries (non-fatal):', queryErr);
                    // Continue even if queries fail - show empty list
                    setQueries([]);
                }
            } catch (err) {
                console.error('Error loading project:', err);
                console.error('Error details:', err.message, err.code, err.stack);
                setError('Failed to load project data: ' + (err.message || 'Unknown error'));
            } finally {
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [projectId, user]);

    const handleDeleteProject = async () => {
        setIsDeleting(true);
        setDeleteError('');

        try {
            await deleteProject(projectId);
            navigate('/projects');
        } catch (err) {
            console.error('Error deleting project:', err);
            setDeleteError(err.message || 'Failed to delete project. Please try again.');
            setIsDeleting(false);
        }
    };

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Edit Name Handlers
    const handleEditStart = () => {
        setEditedName(project.name);
        setIsEditingName(true);
    };

    const handleEditCancel = () => {
        setIsEditingName(false);
        setEditedName('');
    };

    const handleEditSave = async () => {
        if (!editedName.trim() || editedName === project.name) {
            setIsEditingName(false);
            return;
        }

        setIsSavingName(true);
        try {
            await updateProject(projectId, { name: editedName });
            setProject(prev => ({ ...prev, name: editedName }));
            setIsEditingName(false);
        } catch (err) {
            console.error('Error updating project name:', err);
            alert('Failed to update project name');
        } finally {
            setIsSavingName(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleEditSave();
        if (e.key === 'Escape') handleEditCancel();
    };

    const handleDeleteQuery = async (queryId) => {
        if (!window.confirm('Are you sure you want to delete this query?')) return;

        try {
            await deleteQuery(projectId, queryId);
            setQueries(queries.filter(q => q.id !== queryId));
        } catch (err) {
            console.error('Error deleting query:', err);
            alert('Failed to delete query');
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return 'N/A';
        }
    };

    // Helper to resolve image URLs (handles local uploads vs external URLs)
    const resolveImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('/uploads')) {
            return `http://localhost:5000${url}`;
        }
        // Handle legacy base64 or external URLs
        return url;
    };

    if (isLoading) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading project...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link to="/projects" className="text-blue-400 hover:text-blue-300">
                        ← Back to Projects
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full p-4 lg:p-6 lg:px-10">
            {/* Header */}
            <div className="mb-6">
                <Link to="/projects" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
                    ← Back to Projects
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2 mb-1">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="text-2xl font-bold bg-background-dark text-white border border-primary rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/50 w-full max-w-md"
                                    autoFocus
                                    disabled={isSavingName}
                                />
                                <button
                                    onClick={handleEditSave}
                                    disabled={isSavingName}
                                    className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors"
                                    title="Save changes"
                                >
                                    {isSavingName ? (
                                        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    )}
                                </button>
                                <button
                                    onClick={handleEditCancel}
                                    disabled={isSavingName}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                    title="Cancel"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 group mb-1">
                                <h1 className="text-2xl font-bold text-white">{project?.name}</h1>
                                <button
                                    onClick={handleEditStart}
                                    className="text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/5"
                                    title="Edit project name"
                                >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-gray-400 text-sm">
                                Created {formatTimestamp(project?.createdAt)} • {queries.length} {queries.length === 1 ? 'query' : 'queries'}
                            </p>
                            {(project?.modelName || project?.modelId) && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                    {project?.modelName || project?.modelId}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to={`/projects/${projectId}/results`}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Run New Query
                        </Link>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                            Delete Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Project Image */}
            {(project?.originalImageUrl || project?.imageUrl) && (
                <div className="mb-6 bg-surface-dark rounded-lg p-4 border border-border-dark">
                    <h2 className="text-lg font-semibold text-white mb-3">Project Image</h2>
                    <img
                        src={resolveImageUrl(project.originalImageUrl || project.imageUrl)}
                        alt={project.name}
                        className="max-w-full h-auto rounded-lg border border-border-dark"
                        style={{ maxHeight: '400px' }}
                    />
                    {(project.originalImageName || project.imageName) && (
                        <p className="text-sm text-gray-400 mt-2">{project.originalImageName || project.imageName}</p>
                    )}
                </div>
            )}

            {/* Query History */}
            <div className="bg-surface-dark rounded-lg border border-border-dark">
                <div className="px-6 py-4 border-b border-border-dark">
                    <h2 className="text-lg font-semibold text-white">Query History</h2>
                </div>

                {queries.length === 0 ? (
                    <div className="p-8 text-center">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-400 mb-4">No queries yet</p>
                        <Link
                            to={`/projects/${projectId}/segment`}
                            className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            Run Your First Query
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-border-dark">
                        {queries.map((query) => (
                            <div key={query.id} className="p-6 hover:bg-white/5 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${query.status === 'completed' ? 'bg-green-500 bg-opacity-20 text-white' :
                                                query.status === 'failed' ? 'bg-red-500 bg-opacity-20 text-red-400' :
                                                    'bg-yellow-500 bg-opacity-20 text-yellow-400'
                                                }`}>
                                                {query.status}
                                            </span>
                                            <span className="text-sm text-gray-400">
                                                {formatTimestamp(query.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-white font-medium mb-2">"{query.queryText}"</p>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span>Model: {query.modelUsed === 'CADFormer' ? 'CADFormer (Context-Aware)' : query.modelUsed}</span>
                                            {query.processingTime > 0 && (
                                                <span>Time: {query.processingTime.toFixed(1)}s</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => setSelectedQuery(query)}
                                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                                        >
                                            View Result
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuery(query.id)}
                                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Query Result Modal */}
            {selectedQuery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4" onClick={() => setSelectedQuery(null)}>
                    <div className="bg-surface-dark rounded-xl border border-border-dark shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-border-dark flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Query Result</h3>
                            <button
                                onClick={() => setSelectedQuery(null)}
                                className="text-text-muted hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-white mb-4">"{selectedQuery.queryText}"</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedQuery.maskUrl && (
                                    <div>
                                        <p className="text-sm text-text-muted mb-2">Mask</p>
                                        <img
                                            src={resolveImageUrl(selectedQuery.maskUrl)}
                                            alt="Mask"
                                            className="w-full rounded-lg border border-border-dark"
                                        />
                                    </div>
                                )}
                                {selectedQuery.overlayUrl && (
                                    <div>
                                        <p className="text-sm text-text-muted mb-2">Overlay</p>
                                        <img
                                            src={resolveImageUrl(selectedQuery.overlayUrl)}
                                            alt="Overlay"
                                            className="w-full rounded-lg border border-border-dark"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fadeIn">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border-dark flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                                <span className="material-symbols-outlined">warning</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Delete Project</h2>
                                <p className="text-sm text-text-muted">This action cannot be undone</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-gray-300 mb-4">
                                Are you sure you want to delete <span className="font-bold text-white">"{project?.name}"</span>?
                            </p>
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
                                <p className="text-sm text-red-300 flex items-start gap-2">
                                    <span className="material-symbols-outlined text-base mt-0.5">info</span>
                                    <span>This will permanently delete the project and all {queries.length} {queries.length === 1 ? 'query' : 'queries'}.</span>
                                </p>
                            </div>

                            {/* Error Message */}
                            {deleteError && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    <p className="text-sm font-medium">{deleteError}</p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg border border-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteProject}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-red-600/20 hover:shadow-red-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                            Delete Project
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetailPage;
