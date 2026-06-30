import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProjects, deleteProject as deleteProjectFromFirestore, getProject } from '../firebase/firestore';

const ProjectsPage = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [filterModel, setFilterModel] = useState('All');
    const [sortOrder, setSortOrder] = useState('newest');
    const [activeFilter, setActiveFilter] = useState(null);
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const models = [
        { value: 'cadformer', label: 'CADFormer (Context-Aware)' },
        { value: 'rs-ot-sam3', label: 'RS-OT-SAM3' },
    ];

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                const userProjects = await getUserProjects(user.uid);
                // Transform Firestore data to match UI format
                const formattedProjects = userProjects.map(p => ({
                    id: p.id,
                    name: p.name || 'Untitled Project',
                    date: p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
                    model: p.modelName || p.modelId || 'CADFormer',
                    modelId: p.modelId,
                    tag: p.query || 'Segmentation',
                    status: p.status || 'processing',
                    image: (p.originalImageUrl || p.imageUrl) ?
                        ((p.originalImageUrl || p.imageUrl).startsWith('/uploads')
                            ? `http://localhost:5000${p.originalImageUrl || p.imageUrl}`
                            : (p.originalImageUrl || p.imageUrl))
                        : 'https://via.placeholder.com/400x300?text=No+Image'
                }));
                setProjects(formattedProjects);
            } catch (error) {
                console.error('Error fetching projects:', error);
                setProjects([]);
            }
            setIsLoading(false);
        };

        fetchProjects();
    }, [user]);

    const filteredProjects = projects
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (filterModel === 'All' || p.modelId === filterModel || p.model === filterModel ||
                (p.model && p.model.toLowerCase().includes(filterModel.toLowerCase())))
        )
        .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    // Pagination Logic
    const combinedItems = [...filteredProjects, { id: 'create_new_card', isCreate: true }];
    const totalPages = Math.ceil(combinedItems.length / itemsPerPage);
    const paginatedItems = combinedItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterModel, sortOrder]);

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-primary/10 border-primary/20 text-primary',
            processing: 'bg-status-pending/10 border-status-pending/20 text-status-pending',
            failed: 'bg-status-failed/10 border-status-failed/20 text-status-failed',
        };
        return (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${styles[status]} backdrop-blur-md border`}>
                <div className={`size-2 rounded-full ${status === 'processing' ? 'animate-pulse' : ''} ${status === 'completed' ? 'bg-primary' : status === 'processing' ? 'bg-status-pending' : 'bg-status-failed'}`}></div>
                <span className="text-xs font-semibold capitalize">{status}</span>
            </div>
        );
    };

    // Open delete confirmation modal
    const handleDeleteClick = (project) => {
        setProjectToDelete(project);
        setDeleteError('');
        setShowDeleteModal(true);
    };

    // Cancel delete
    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setProjectToDelete(null);
        setDeleteError('');
    };

    // Confirm and execute delete
    const handleConfirmDelete = async () => {
        if (!projectToDelete || !user) return;

        setIsDeleting(true);
        setDeleteError('');

        try {
            // Verify ownership before deleting
            const projectData = await getProject(projectToDelete.id);

            if (!projectData) {
                setDeleteError('Project not found. It may have already been deleted.');
                setIsDeleting(false);
                return;
            }

            // Check if user owns this project
            if (projectData.userId !== user.uid && projectData.ownerId !== user.uid) {
                setDeleteError('You do not have permission to delete this project.');
                setIsDeleting(false);
                return;
            }

            // Perform deletion (deletes queries subcollection and project document)
            await deleteProjectFromFirestore(projectToDelete.id);

            // Update UI - remove project from list
            setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));

            // Close modal
            setShowDeleteModal(false);
            setProjectToDelete(null);
        } catch (error) {
            console.error('Error deleting project:', error);
            setDeleteError(
                error.code === 'permission-denied'
                    ? 'You do not have permission to delete this project.'
                    : 'Failed to delete project. Please try again.'
            );
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                    <p className="text-text-muted">Loading projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <header className="w-full px-4 md:px-8 py-6 bg-background-dark/90 backdrop-blur-sm sticky top-0 z-10 border-b border-border-dark/50">
                <div className="max-w-7xl mx-auto flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-3xl font-black tracking-tight text-white">Projects</h2>
                            <p className="text-text-muted">Manage and analyze your segmentation tasks</p>
                        </div>
                        <Link
                            to="/segmentation/new"
                            className="flex items-center justify-center gap-2 bg-primary hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-xl">add</span>
                            <span>New Project</span>
                        </Link>
                    </div>

                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
                        {/* Search */}
                        <div className="relative w-full lg:max-w-md group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-text-muted group-focus-within:text-primary transition-colors">search</span>
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by project name..."
                                className="block w-full pl-10 pr-3 py-2.5 border border-border-dark rounded-lg leading-5 bg-surface-dark text-white placeholder-text-muted focus:outline-none focus:bg-background-dark focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all shadow-sm"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 w-full lg:w-auto">
                            <div className="relative">
                                <button
                                    onClick={() => setActiveFilter(activeFilter === 'model' ? null : 'model')}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === 'model' || filterModel !== 'All' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-dark border-border-dark hover:border-text-muted text-white'}`}
                                >
                                    <span>Model: {models.find(m => m.value === filterModel)?.label || 'All'}</span>
                                    <span className="material-symbols-outlined text-base">expand_more</span>
                                </button>

                                {activeFilter === 'model' && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setActiveFilter(null)}></div>
                                        <div className="absolute top-full mt-2 left-0 w-64 bg-surface-dark border border-border-dark rounded-xl shadow-xl z-20 py-2 animate-fadeIn">
                                            <button
                                                onClick={() => { setFilterModel('All'); setActiveFilter(null); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${filterModel === 'All' ? 'text-primary' : 'text-text-muted'}`}
                                            >
                                                <span>All Models</span>
                                                {filterModel === 'All' && <span className="material-symbols-outlined text-lg">check</span>}
                                            </button>
                                            <div className="h-px bg-border-dark my-1"></div>
                                            {models.map((model) => (
                                                <button
                                                    key={model.value}
                                                    onClick={() => { setFilterModel(model.value); setActiveFilter(null); }}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${filterModel === model.value ? 'text-primary' : 'text-text-muted'}`}
                                                >
                                                    <span>{model.label}</span>
                                                    {filterModel === model.value && <span className="material-symbols-outlined text-lg">check</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveFilter(activeFilter === 'sort' ? null : 'sort')}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === 'sort' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-dark border-border-dark hover:border-text-muted text-white'
                                        }`}
                                >
                                    <span>Sort: {sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                                    <span className="material-symbols-outlined text-base">sort</span>
                                </button>

                                {activeFilter === 'sort' && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setActiveFilter(null)}></div>
                                        <div className="absolute top-full mt-2 right-0 w-48 bg-surface-dark border border-border-dark rounded-xl shadow-xl z-20 py-2 animate-fadeIn">
                                            <button
                                                onClick={() => { setSortOrder('newest'); setActiveFilter(null); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortOrder === 'newest' ? 'text-primary' : 'text-text-muted'
                                                    }`}
                                            >
                                                <span>Newest First</span>
                                                {sortOrder === 'newest' && <span className="material-symbols-outlined text-lg">check</span>}
                                            </button>
                                            <button
                                                onClick={() => { setSortOrder('oldest'); setActiveFilter(null); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortOrder === 'oldest' ? 'text-primary' : 'text-text-muted'
                                                    }`}
                                            >
                                                <span>Oldest First</span>
                                                {sortOrder === 'oldest' && <span className="material-symbols-outlined text-lg">check</span>}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="h-6 w-px bg-border-dark mx-2 hidden lg:block"></div>

                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                                title="List View"
                            >
                                <span className="material-symbols-outlined">view_list</span>
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                                title="Grid View"
                            >
                                <span className="material-symbols-outlined">grid_view</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className={viewMode === 'grid'
                        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                        : "flex flex-col gap-4"
                    }>
                        {paginatedItems.map((item) => (
                            item.isCreate ? (
                                /* Create New Card */
                                <Link
                                    key={item.id}
                                    to="/segmentation/new"
                                    className={`group flex flex-col items-center justify-center gap-4 bg-background-dark/50 rounded-xl border-2 border-dashed border-border-dark hover:border-primary/50 hover:bg-surface-dark/50 transition-all duration-300 ${viewMode === 'list' ? 'flex-row h-24 gap-6' : 'h-full min-h-[360px]'
                                        }`}
                                >
                                    <div className={`rounded-full bg-background-dark group-hover:bg-primary/20 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'size-12' : 'size-16'
                                        }`}>
                                        <span className={`material-symbols-outlined text-text-muted group-hover:text-primary ${viewMode === 'list' ? 'text-2xl' : 'text-3xl'
                                            }`}>add</span>
                                    </div>
                                    <div className={viewMode === 'list' ? 'text-left' : 'text-center'}>
                                        <p className="text-lg font-bold text-white group-hover:text-primary transition-colors">Create New Project</p>
                                        <p className="text-sm text-text-muted">Start a new segmentation task</p>
                                    </div>
                                </Link>
                            ) : (
                                /* Project Card */
                                <article key={item.id} className={`group bg-surface-dark rounded-xl overflow-hidden shadow-lg border border-border-dark/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1 relative ${viewMode === 'list' ? 'flex flex-row h-40' : 'flex flex-col'
                                    }`}>
                                    <div className={`relative overflow-hidden bg-background-dark ${viewMode === 'list' ? 'w-64 h-full shrink-0' : 'h-48 w-full'
                                        }`}>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                            style={{ backgroundImage: `url('${item.image}')` }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent opacity-80"></div>
                                    </div>

                                    <div className={`p-5 flex relative ${viewMode === 'list' ? 'flex-1 flex-row gap-4' : 'flex-col gap-4'
                                        }`}>
                                        {/* Left Section: Project Info */}
                                        <div className={`flex flex-col ${viewMode === 'list' ? 'flex-1 min-w-0 pt-1 justify-between h-full' : 'gap-1'}`}>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-white leading-tight group-hover:text-primary transition-colors truncate mb-1">{item.name}</h3>
                                                    {viewMode === 'grid' && (
                                                        <button
                                                            onClick={() => handleDeleteClick(item)}
                                                            className="text-text-muted hover:text-red-400 transition-colors p-1 rounded-full hover:bg-white/5 ml-auto"
                                                            title="Delete project"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <p className="text-sm text-text-muted flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base">calendar_today</span>
                                                    {item.date}
                                                </p>
                                            </div>

                                            {viewMode === 'list' && (
                                                <div className="flex items-center gap-2 mt-auto pb-1">
                                                    <span className="px-2 py-0.5 rounded bg-background-dark/50 border border-border-dark/50 text-xs font-medium text-slate-300">{item.model}</span>
                                                    <span className="px-2 py-0.5 rounded bg-background-dark/50 border border-border-dark/50 text-xs font-medium text-slate-300">{item.tag}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Section: Actions (List View Only) - Top/Bottom Alignment */}
                                        {viewMode === 'list' && (
                                            <div className="flex flex-col justify-between items-center shrink-0 pl-4 h-full">
                                                <button
                                                    onClick={() => handleDeleteClick(item)}
                                                    className="text-text-muted hover:text-red-400 transition-colors p-2 -mr-2 -mt-2 rounded-full hover:bg-red-500/10"
                                                    title="Delete project"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>

                                                <Link
                                                    to={`/projects/${item.id}`}
                                                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary hover:text-green-400 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                                                >
                                                    Open Project
                                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                                </Link>
                                            </div>
                                        )}

                                        {/* Grid View: Tags and Actions */}
                                        {viewMode === 'grid' && (
                                            <>
                                                <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
                                                    <span className="px-2 py-1 rounded bg-background-dark/50 border border-border-dark/50">{item.model}</span>
                                                    <span className="px-2 py-1 rounded bg-background-dark/50 border border-border-dark/50">{item.tag}</span>
                                                </div>

                                                <Link
                                                    to={`/projects/${item.id}`}
                                                    className="w-[calc(100%+2.5rem)] -mx-5 -mb-5 pt-3 pb-4 border-t border-border-dark/50 flex items-center justify-center gap-2 mt-auto text-sm font-semibold text-primary hover:text-white hover:bg-primary transition-all group/btn rounded-b-xl"
                                                >
                                                    Open Project
                                                    <span className="material-symbols-outlined text-lg group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </article>
                            )
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredProjects.length === 0 && searchTerm && (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-text-muted text-4xl mb-2">search_off</span>
                            <p className="text-text-muted">No projects found matching "{searchTerm}"</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {combinedItems.length > 0 && (
                        <div className="mt-8 flex items-center justify-between border-t border-border-dark pt-6">
                            <p className="text-sm text-text-muted">Showing <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, combinedItems.length)}</span> of <span className="text-white font-medium">{combinedItems.length}</span> items</p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg border border-border-dark text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-border-dark text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && projectToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/30 backdrop-blur-md transition-all duration-300">
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
                                Are you sure you want to delete <span className="font-bold text-white">"{projectToDelete.name}"</span>?
                            </p>
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
                                <p className="text-sm text-red-300 flex items-start gap-2">
                                    <span className="material-symbols-outlined text-base mt-0.5">info</span>
                                    <span>This will permanently delete the project, all segmentation queries, and results.</span>
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
                                    onClick={handleCancelDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg border border-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
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

export default ProjectsPage;
