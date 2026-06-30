import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProject, addQueryToProject, updateProject, setProjectImage, getAllModels } from '../firebase/firestore';
import ProjectNameModal from '../components/ProjectNameModal';

const NewSegmentationPage = () => {
    const { projectId } = useParams();
    console.log('DEBUG: NewSegmentationPage loaded. ProjectId:', projectId);
    const { user } = useAuth();
    const navigate = useNavigate();

    // Project state
    const [project, setProject] = useState(null);
    const [isLoadingProject, setIsLoadingProject] = useState(!!projectId);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [isImageLocked, setIsImageLocked] = useState(false);

    // Auto-open modal if no project ID is present
    useEffect(() => {
        if (!projectId) {
            setShowProjectModal(true);
        }
    }, [projectId]);

    const handleProjectCreated = (newProjectId) => {
        setShowProjectModal(false);
        // Navigate to the same page but with the project ID
        navigate(`/projects/${newProjectId}/segment`, { replace: true });
    };

    // Form state
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageDimensions, setImageDimensions] = useState(null); // Kept from original
    const [query, setQuery] = useState('');
    const [selectedModel, setSelectedModel] = useState('cadformer');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedClasses, setSelectedClasses] = useState([]);  // Start with no classes selected // Kept from original
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [queryError, setQueryError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1); // Kept from original
    const fileInputRef = useRef(null);

    // Models state
    const [models, setModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    // Zoom constants
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.25;

    // RefSegRS Dataset - 20 Classes (CADFormer Training Classes)
    const classes = [
        { id: 'airplane', label: 'Airplane', color: 'bg-sky-400', shadow: 'rgba(56,189,248,0.4)' },
        { id: 'golf_field', label: 'Golf Field', color: 'bg-lime-500', shadow: 'rgba(132,204,22,0.4)' },
        { id: 'airport', label: 'Airport', color: 'bg-slate-500', shadow: 'rgba(100,116,139,0.4)' },
        { id: 'storage_tank', label: 'Storage Tank', color: 'bg-zinc-500', shadow: 'rgba(113,113,122,0.4)' },
        { id: 'stadium', label: 'Stadium', color: 'bg-purple-500', shadow: 'rgba(168,85,247,0.4)' },
        { id: 'ground_track_field', label: 'Ground Track Field', color: 'bg-red-400', shadow: 'rgba(248,113,113,0.4)' },
        { id: 'baseball_field', label: 'Baseball Field', color: 'bg-amber-600', shadow: 'rgba(217,119,6,0.4)' },
        { id: 'expressway_service_area', label: 'Expressway Service Area', color: 'bg-gray-600', shadow: 'rgba(75,85,99,0.4)' },
        { id: 'basketball_court', label: 'Basketball Court', color: 'bg-orange-500', shadow: 'rgba(249,115,22,0.4)' },
        { id: 'tennis_court', label: 'Tennis Court', color: 'bg-green-600', shadow: 'rgba(22,163,74,0.4)' },
        { id: 'overpass', label: 'Overpass', color: 'bg-stone-500', shadow: 'rgba(120,113,108,0.4)' },
        { id: 'bridge', label: 'Bridge', color: 'bg-gray-500', shadow: 'rgba(107,114,128,0.4)' },
        { id: 'harbor', label: 'Harbor', color: 'bg-cyan-600', shadow: 'rgba(8,145,178,0.4)' },
        { id: 'train_station', label: 'Train Station', color: 'bg-indigo-500', shadow: 'rgba(99,102,241,0.4)' },
        { id: 'ship', label: 'Ship', color: 'bg-blue-600', shadow: 'rgba(37,99,235,0.4)' },
        { id: 'windmill', label: 'Windmill', color: 'bg-teal-500', shadow: 'rgba(20,184,166,0.4)' },
        { id: 'dam', label: 'Dam', color: 'bg-cyan-700', shadow: 'rgba(14,116,144,0.4)' },
        { id: 'chimney', label: 'Chimney', color: 'bg-rose-600', shadow: 'rgba(225,29,72,0.4)' },
        { id: 'vehicle', label: 'Vehicle', color: 'bg-red-600', shadow: 'rgba(220,38,38,0.4)' },
        { id: 'expressway_toll_station', label: 'Expressway Toll Station', color: 'bg-yellow-600', shadow: 'rgba(202,138,4,0.4)' },
    ];

    // Fetch models from Firestore
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const allModels = await getAllModels();
                setModels(allModels);

                // Set default model to first enabled model
                const enabledModel = allModels.find(m => m.status === 'enabled');
                if (enabledModel) {
                    setSelectedModel(enabledModel.id);
                }
            } catch (error) {
                console.error('Error fetching models:', error);
            } finally {
                setIsLoadingModels(false);
            }
        };
        fetchModels();
    }, []);

    // Supported image formats
    const supportedFormats = '.jpg,.jpeg,.png,.tif,.tiff,.bmp,.gif,.webp,.svg';

    // Clear any previous segmentation results when starting new segmentation
    useEffect(() => {
        sessionStorage.removeItem('segmentation_result');
    }, []);

    // Load project data if projectId is provided
    useEffect(() => {
        const loadProject = async () => {
            if (!projectId || !user) return;

            setIsLoadingProject(true);
            try {
                const projectData = await getProject(projectId);

                if (!projectData) {
                    setQueryError('Project not found');
                    setIsLoadingProject(false);
                    return;
                }

                // Check if user owns this project (check both ownerId and legacy userId)
                if (projectData.ownerId !== user.uid && projectData.userId !== user.uid) {
                    setQueryError('You do not have permission to access this project');
                    setIsLoadingProject(false);
                    return;
                }

                setProject(projectData);

                // Set model from project (locked at creation)
                if (projectData.modelId) {
                    setSelectedModel(projectData.modelId);
                }

                // Load project image if available (use originalImageUrl or legacy imageUrl)
                const imageUrl = projectData.originalImageUrl || projectData.imageUrl;
                const imageName = projectData.originalImageName || projectData.imageName;

                if (imageUrl) {
                    setImagePreview(imageUrl);
                    setIsImageLocked(true); // Image is locked once set

                    // Create a dummy file object for compatibility
                    try {
                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const file = new File([blob], imageName || 'project-image.png', { type: blob.type });
                        setSelectedImage(file);
                    } catch (fetchError) {
                        console.warn('Could not fetch image for file object:', fetchError);
                    }

                    // Get image dimensions
                    const img = new Image();
                    img.onload = () => {
                        setImageDimensions({ width: img.width, height: img.height });
                    };
                    img.src = imageUrl;
                }
            } catch (error) {
                console.error('Error loading project:', error);
                setQueryError('Failed to load project');
            } finally {
                setIsLoadingProject(false);
            }
        };

        loadProject();
    }, [projectId, user]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
                // Get image dimensions
                const img = new Image();
                img.onload = () => {
                    setImageDimensions({ width: img.width, height: img.height });
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = () => {
        if (!projectId && !project) {
            setShowProjectModal(true);
            return;
        }
        if (isImageLocked) {
            setQueryError('Image is locked for this project. You cannot change it.');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleRemoveFile = () => {
        if (isImageLocked) {
            setQueryError('Image is locked for this project. You cannot remove it.');
            return;
        }
        setSelectedImage(null);
        setPreviewUrl(null);
        setImageDimensions(null);
        setZoomLevel(1);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Zoom handlers
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
    };

    const handleResetView = () => {
        setZoomLevel(1);
    };

    const toggleClass = (classId) => {
        setSelectedClasses(prev =>
            prev.includes(classId)
                ? prev.filter(c => c !== classId)
                : [...prev, classId]
        );
    };

    const handleRunSegmentation = async () => {
        // Ensure we have a project context
        if (!projectId && !project) {
            setShowProjectModal(true);
            return;
        }

        // Client-side validation
        if (!selectedImage) {
            setQueryError('Please upload an image first.');
            return;
        }

        // Validate query is not empty or whitespace
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setQueryError('Please enter a natural language query before running segmentation.');
            return;
        }

        // Validate model is integrated before making API call
        const modelObj = models.find(m => m.id === selectedModel);
        if (!modelObj || modelObj.isIntegrated !== true) {
            setQueryError(`The model "${modelObj?.name || selectedModel}" is not integrated in the backend yet.`);
            return;
        }

        setQueryError('');
        setIsSubmitting(true);

        try {
            // Create form data with image, query, model selection, and project_id
            const formData = new FormData();
            formData.append('image', selectedImage);
            formData.append('query', trimmedQuery);
            formData.append('model', selectedModel);

            // Send project_id to backend for file organization
            if (projectId) {
                formData.append('project_id', projectId);
            }

            // Send user_id for credit deduction
            if (user) {
                formData.append('user_id', user.uid);
            }

            // Call the segmentation API
            const response = await fetch('/api/segment', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Segmentation failed');
            }

            // Check if model is integrated (backend validation)
            if (data.success === false) {
                throw new Error(data.error || 'Model not integrated');
            }

            // Store results in sessionStorage for the results page (for immediate display)
            // Only if we are NOT in a project (Quick Mode). Project mode fetches from Firestore.
            if (!projectId) {
                sessionStorage.setItem('segmentation_result', JSON.stringify({
                    mask: data.mask,
                    overlay: data.overlay,
                    original: data.original,
                    query: data.query,
                    model: data.model || 'CADFormer',
                    filename: selectedImage.name,
                    // Also store URLs for persistent access
                    maskUrl: data.mask_url,
                    originalUrl: data.original_url
                }));
            }

            // If in project mode, save query to Firestore with URLs
            if (projectId && user) {
                try {
                    // Use project's model name for query
                    const modelName = project?.modelName || data.model || 'CADFormer';

                    console.log('🟢 NewSegmentationPage: About to save query to Firestore', { projectId, queryText: trimmedQuery });

                    // Save query with permanent URLs (not base64)
                    await addQueryToProject(projectId, {
                        queryText: trimmedQuery,
                        modelUsed: modelName,
                        maskUrl: data.mask_url || '',           // Permanent mask URL
                        overlayUrl: data.overlay_url || '',     // Overlay URL if available
                        originalUrl: data.original_url || '',   // Original image URL
                        status: 'completed',
                        coverage: data.coverage_percent || 0,
                        processingTime: 0
                    });

                    console.log('✅ NewSegmentationPage: Query saved successfully to Firestore');

                    // Clear query field for next query
                    setQuery('');

                    // Save project image if not already set (first run)
                    const currentImageUrl = project?.originalImageUrl || project?.imageUrl;
                    if (!currentImageUrl && data.original_url) {
                        // Save the permanent URL to project
                        await setProjectImage(projectId, data.original_url, selectedImage.name);

                        // Update local project state
                        setProject(prev => ({
                            ...prev,
                            originalImageUrl: data.original_url,
                            imageName: selectedImage.name
                        }));

                        // Lock image upload after first save
                        setIsImageLocked(true);
                    }
                } catch (firestoreError) {
                    console.error('Error saving query to Firestore:', firestoreError);
                }
            }

            // Keep isSubmitting(true) here to maintain the loading state until the page unmounts/navigates
            // This ensures the user sees "Processing..." right up until the Results page appears

            // Automatically navigate to results page
            console.log('🔍 NewSegmentationPage: Navigating to results with projectId:', projectId);
            if (projectId) {
                // Navigate to project-specific results page
                navigate(`/projects/${projectId}/results`);
            } else {
                // Navigate to demo results page (no project context)
                navigate('/results');
            }
        } catch (error) {
            console.error('Segmentation error:', error);
            setQueryError(error.message || 'Segmentation failed. Please try again.');
            setIsSubmitting(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    if (isLoadingProject) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading project...</p>
                </div>
            </div>
        );
    }



    return (
        <div className="min-h-full p-4 lg:p-6 lg:px-10 flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-[-0.033em] text-white">
                        New Segmentation
                    </h1>
                    <p className="text-text-muted text-base font-normal">
                        {project ? `Project: ${project.name}` : 'Language-guided segmentation for aerial and satellite imagery'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium border border-primary/30">version-1</span>
                </div>
            </div>

            {/* Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left Column: Upload & Preview */}
                <div className="lg:col-span-8 flex flex-col gap-4 min-h-[500px]">
                    <div className="flex-1 bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden flex flex-col relative">

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept={supportedFormats}
                            className="hidden"
                        />

                        {!selectedImage ? (
                            /* Empty State - Upload Prompt */
                            <div
                                className="flex-1 flex flex-col items-center justify-center p-8"
                            >
                                <div
                                    className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 border-2 border-dashed border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors"
                                    onClick={handleUploadClick}
                                >
                                    <span className="material-symbols-outlined text-primary text-5xl">cloud_upload</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Upload Image</h3>
                                <p className="text-text-muted text-center max-w-md mb-6">
                                    Click the button below to browse and select an image from your local system
                                </p>
                                <button
                                    onClick={handleUploadClick}
                                    className="px-6 py-3 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">folder_open</span>
                                    Browse Files
                                </button>
                                <p className="text-xs text-text-muted mt-4">
                                    Supported formats: JPG, JPEG, PNG, TIFF, BMP, GIF, WebP, SVG
                                </p>
                            </div>
                        ) : (
                            /* Image Preview State */
                            <>
                                {/* Toolbar overlay */}
                                <div className="absolute top-4 left-4 z-10 flex gap-2">
                                    <button
                                        onClick={handleZoomIn}
                                        disabled={zoomLevel >= MAX_ZOOM}
                                        className="group relative flex items-center justify-center size-10 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur border border-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Zoom In</span>
                                    </button>
                                    <button
                                        onClick={handleZoomOut}
                                        disabled={zoomLevel <= MIN_ZOOM}
                                        className="group relative flex items-center justify-center size-10 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur border border-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Zoom Out</span>
                                    </button>
                                    <button
                                        onClick={handleResetView}
                                        disabled={zoomLevel === 1}
                                        className="group relative flex items-center justify-center size-10 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur border border-white/10 transition-all ml-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined">center_focus_strong</span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Reset View</span>
                                    </button>
                                    {zoomLevel !== 1 && (
                                        <div className="ml-2 px-2 py-1.5 rounded-lg bg-black/50 text-white backdrop-blur border border-white/10 text-xs font-mono">
                                            {Math.round(zoomLevel * 100)}%
                                        </div>
                                    )}
                                </div>

                                {/* Uploaded Preview Label */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                                    <div className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur border border-white/10 text-sm font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">image</span>
                                        Uploaded Preview
                                    </div>
                                </div>

                                {/* Status Bar */}
                                <div className="absolute top-4 right-4 z-10">
                                    <div className="px-3 py-1.5 rounded-lg bg-black/50 text-white backdrop-blur border border-white/10 text-xs font-mono flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        IMAGE LOADED
                                    </div>
                                </div>

                                {/* Main Image Area */}
                                <div className="flex-1 w-full bg-background-dark relative flex items-center justify-center bg-[radial-gradient(#2b362f_1px,transparent_1px)] [background-size:16px_16px] overflow-hidden">
                                    <img
                                        src={imagePreview}
                                        alt="Uploaded preview"
                                        className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
                                        style={{ transform: `scale(${zoomLevel})` }}
                                        draggable={false}
                                    />
                                </div>

                                {/* Bottom File Info Bar */}
                                <div className="p-4 bg-panel-dark border-t border-border-dark flex flex-col sm:flex-row items-center gap-4 justify-between">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <span className="material-symbols-outlined">image</span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-sm font-bold truncate text-white">
                                                {selectedImage.name}
                                            </p>
                                            <p className="text-xs text-text-muted font-mono">
                                                {formatFileSize(selectedImage.size)}
                                                {imageDimensions && ` • ${imageDimensions.width}x${imageDimensions.height}px`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 sm:flex-none px-4 py-2 bg-border-dark hover:bg-white/10 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-white"
                                        >
                                            <span className="material-symbols-outlined text-lg">folder_open</span>
                                            Change File
                                        </button>
                                        <button
                                            onClick={handleRemoveFile}
                                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 border border-red-500/20"
                                        >
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Column: Configuration */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    {/* Query & Model Card */}
                    <div className="bg-surface-dark rounded-xl shadow-sm border border-border-dark p-5 flex flex-col gap-5">
                        <div className="flex items-center gap-2 pb-2 border-b border-border-dark">
                            <span className="material-symbols-outlined text-primary">psychology</span>
                            <h3 className="text-lg font-bold text-white">Analysis Configuration</h3>
                        </div>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-gray-200">Natural Language Query <span className="text-red-400">*</span></span>
                            <textarea
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (queryError) setQueryError('');
                                }}
                                className={`w-full rounded-lg bg-input-bg-dark border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none h-28 placeholder-text-muted text-white transition-all ${queryError ? 'border-red-500' : 'border-border-dark'}`}
                                placeholder="Describe what you want to segment (e.g., 'segment the car near the bridge')"
                            />
                            {queryError && (
                                <div className="flex items-center gap-2 text-red-400 text-sm mt-1">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    <span>{queryError}</span>
                                </div>
                            )}
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-gray-200">
                                Model Architecture
                                {project?.modelId && (
                                    <span className="ml-2 text-xs text-yellow-400 font-normal">(Locked)</span>
                                )}
                            </span>
                            {project?.modelId ? (
                                /* Locked Model Badge */
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-input-bg-dark border border-border-dark">
                                    <span className="material-symbols-outlined text-yellow-400">lock</span>
                                    <span className="text-white font-medium">{project.modelName || project.modelId}</span>
                                </div>
                            ) : (
                                /* Editable Model Selector */
                                <div className="relative">
                                    {isLoadingModels ? (
                                        <div className="w-full rounded-lg bg-input-bg-dark border border-border-dark p-3 text-sm text-text-muted flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                            Loading models...
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={selectedModel}
                                                onChange={(e) => setSelectedModel(e.target.value)}
                                                className="w-full appearance-none rounded-lg bg-input-bg-dark border border-border-dark p-3 pr-10 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer text-white transition-all"
                                            >
                                                {models.map(m => {
                                                    const isDisabled = m.status === 'disabled' || m.isIntegrated !== true;
                                                    const statusLabel = m.status === 'disabled'
                                                        ? ' (Disabled)'
                                                        : (m.isIntegrated !== true ? ' (Pending Code Integration)' : '');
                                                    return (
                                                        <option
                                                            key={m.id}
                                                            value={m.id}
                                                            disabled={isDisabled}
                                                            className={isDisabled ? 'text-gray-500' : ''}
                                                        >
                                                            {m.name}{statusLabel}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-text-muted">
                                                <span className="material-symbols-outlined">expand_more</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </label>
                    </div>

                    {/* Model Training Classes - Informational Display */}
                    <div className="bg-surface-dark rounded-xl shadow-sm border border-border-dark p-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-3 pb-3 border-b border-border-dark">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">precision_manufacturing</span>
                                <h3 className="text-lg font-bold text-white">Model Training Classes</h3>
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed">
                                Our Model is trained on <span className="text-primary font-semibold">20 object classes</span> from the RRSIS dataset.
                                These are the objects the model can segment in aerial/satellite imagery.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {classes.map(cls => (
                                <div
                                    key={cls.id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-input-bg-dark/30 border border-border-dark/50 hover:border-primary/30 transition-all"
                                    title={cls.label}
                                >
                                    <span
                                        className={`size-3 rounded-full flex-shrink-0 ${cls.color}`}
                                        style={{ boxShadow: `0 0 8px ${cls.shadow}` }}
                                    ></span>
                                    <span className="text-sm font-medium text-white truncate">{cls.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Run Segmentation Button */}
                    <div className="bg-surface-dark rounded-xl shadow-sm border border-border-dark p-5">
                        <button
                            onClick={handleRunSegmentation}
                            disabled={isSubmitting || !selectedImage}
                            className="w-full group relative overflow-hidden rounded-lg bg-primary hover:bg-green-600 text-white p-4 transition-all duration-300 shadow-[0_0_15px_rgba(50,164,90,0.3)] hover:shadow-[0_0_25px_rgba(50,164,90,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                <span className={`material-symbols-outlined ${isSubmitting ? 'animate-spin' : ''}`}>
                                    {isSubmitting ? 'progress_activity' : 'rocket_launch'}
                                </span>
                                <span className="text-base font-bold tracking-wide">
                                    {isSubmitting ? 'PROCESSING...' : !selectedImage ? 'UPLOAD IMAGE FIRST' : !query.trim() ? 'ENTER QUERY FIRST' : 'RUN SEGMENTATION'}
                                </span>
                            </div>
                            <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full"></div>
                        </button>
                        {selectedImage && (
                            <p className="text-center text-xs text-text-muted mt-3 font-mono">
                                Estimated time: ~30s to segment the object
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Project Creation Modal */}
            <ProjectNameModal
                isOpen={showProjectModal}
                onClose={() => {
                    // If they close without creating, maybe redirect or just let them stay?
                    // For now, let them close it, but they see "New Segmentation Task"
                    setShowProjectModal(false);
                }}
                onProjectCreated={handleProjectCreated}
            />
        </div>
    );
};

export default NewSegmentationPage;
