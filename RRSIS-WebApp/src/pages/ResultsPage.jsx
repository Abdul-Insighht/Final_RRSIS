import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addQueryToProject, getProjectQueries, getProject } from '../firebase/firestore';

const ResultsPage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams(); // Get projectId from URL
    const { user, userProfile } = useAuth();

    // Debug: Log URL and projectId on mount
    useEffect(() => {
        console.log('🔍 ResultsPage MOUNTED:', {
            currentURL: window.location.href,
            pathname: window.location.pathname,
            projectId: projectId,
            hasProjectId: !!projectId
        });

        // Cleanup: Clear temporary results from sessionStorage when leaving the page
        // This ensures a clean state for the next visit (unless accessing via NewSegmentation)
        return () => {
            console.log('🧹 ResultsPage Unmounting: Clearing segmentation_result from sessionStorage');
            sessionStorage.removeItem('segmentation_result');
        };
    }, [projectId]);

    const [opacity, setOpacity] = useState(60);
    const [splitPosition, setSplitPosition] = useState(50);
    const [viewMode, setViewMode] = useState('overlay'); // 'split', 'overlay', or 'mask'
    const [isDragging, setIsDragging] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [segmentationResult, setSegmentationResult] = useState(null);
    const [newQuery, setNewQuery] = useState('');
    const [projectDetails, setProjectDetails] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [queryError, setQueryError] = useState('');
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const imageContainerRef = useRef(null);

    // Convert base64 to Blob for API submission
    const base64ToBlob = (base64, mimeType = 'image/png') => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    };

    // Run new segmentation with a different query on the same image
    const runNewQuery = async () => {
        const trimmedQuery = newQuery.trim();
        if (!trimmedQuery) {
            setQueryError('Please enter a query');
            return;
        }

        // Credit Check
        if ((userProfile?.credits || 0) < 1) {
            setQueryError('Insufficient credits. Please upgrade your plan.');
            window.dispatchEvent(new CustomEvent('OPEN_PAYMENT_MODAL'));
            return;
        }

        // Check if we have an image (either base64 or URL)
        const hasImage = segmentationResult?.original || segmentationResult?.originalUrl;
        if (!hasImage) {
            setQueryError('No original image available');
            return;
        }

        setIsProcessing(true);
        setQueryError('');

        try {
            let imageFile;

            // If we have base64, use it directly
            if (segmentationResult.original) {
                const imageBlob = base64ToBlob(segmentationResult.original);
                imageFile = new File([imageBlob], segmentationResult.filename || 'image.png', { type: 'image/png' });
            } else if (segmentationResult.originalUrl) {
                // Fetch the image from URL (resolve relative URLs first)
                const absoluteUrl = segmentationResult.originalUrl.startsWith('/uploads')
                    ? `http://localhost:5000${segmentationResult.originalUrl}`
                    : segmentationResult.originalUrl;
                const imageResponse = await fetch(absoluteUrl);
                const imageBlob = await imageResponse.blob();
                imageFile = new File([imageBlob], segmentationResult.filename || 'image.png', { type: imageBlob.type });
            }

            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('query', trimmedQuery);
            formData.append('model', projectDetails?.modelId || 'cadformer');

            // Pass user_id for credit deduction (Required by backend)
            if (user?.uid) {
                formData.append('user_id', user.uid);
            }

            // Critical: duplicate check requires project_id to save images to disk
            if (projectId) {
                console.log('Sending project_id to backend:', projectId);
                formData.append('project_id', projectId);
            }

            const token = localStorage.getItem('geosegai_token');
            const response = await fetch('http://localhost:5000/api/segment', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Segmentation failed');
            }

            // Update results with new segmentation
            const newResult = {
                mask: data.mask,
                overlay: data.overlay,
                original: data.original,
                query: data.query,
                model: data.model || 'CADFormer',  // Include model name
                filename: segmentationResult.filename,
                // Store URLs if available
                maskUrl: data.mask_url,
                overlayUrl: data.overlay_url,
                originalUrl: data.original_url
            };

            setSegmentationResult(newResult);
            setNewQuery('');
            setIsProcessing(false); // Stop loading immediately for better UX

            // Debug: Check what values we have
            console.log('🔍 ResultsPage DEBUG:', {
                projectId,
                hasUser: !!user,
                userId: user?.uid,
                willSave: !!(projectId && user)
            });

            // Save query to Firestore if in project mode
            if (projectId && user) {
                try {
                    console.log('🟢 ResultsPage: Saving query to Firestore', { projectId, queryText: trimmedQuery });
                    await addQueryToProject(projectId, {
                        queryText: trimmedQuery,
                        modelUsed: data.model || 'CADFormer',
                        maskUrl: data.mask_url || '',
                        overlayUrl: data.overlay_url || '',
                        originalUrl: data.original_url || '',
                        status: 'completed',
                        coverage: data.coverage_percent || 0,
                        processingTime: 0
                    });
                    console.log('✅ ResultsPage: Query saved successfully');
                } catch (firestoreError) {
                    console.error('❌ ResultsPage: Error saving query:', firestoreError);
                    // Don't block the UI even if save fails
                }
            } else {
                console.warn('⚠️ ResultsPage: NOT saving - projectId or user is missing');
            }

            // setIsProcessing(false) moved up to unblock UI
        } catch (error) {
            console.error('Re-segmentation error:', error);
            setQueryError(error.message || 'Segmentation failed. Please try again.');
            setIsProcessing(false);
        }
    };

    // Zoom constants
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.25;

    // Fetch last query from project if projectId exists
    useEffect(() => {
        const fetchLastQuery = async () => {
            if (!projectId) {
                // No projectId, check sessionStorage
                const storedResult = sessionStorage.getItem('segmentation_result');
                if (storedResult) {
                    try {
                        const result = JSON.parse(storedResult);
                        setSegmentationResult(result);
                    } catch (e) {
                        console.error('Failed to parse segmentation result:', e);
                        navigate('/segmentation/new');
                    }
                } else {
                    navigate('/segmentation/new');
                }
                return;
            }

            // ProjectId exists, fetch last query from Firestore
            setIsLoadingHistory(true);
            try {
                console.log('🔍 Fetching last query for project:', projectId);

                // Fetch both queries and project details (for fallback image)
                const [queries, project] = await Promise.all([
                    getProjectQueries(projectId),
                    getProject(projectId)
                ]);
                setProjectDetails(project);

                if (queries && queries.length > 0) {
                    // Sort by createdAt descending to get the most recent
                    const sortedQueries = queries.sort((a, b) => {
                        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return bTime - aTime;
                    });

                    const lastQuery = sortedQueries[0];
                    console.log('✅ Found last query:', lastQuery);
                    console.log('🔎 Query Image URLs:', {
                        mask: lastQuery.maskUrl,
                        overlay: lastQuery.overlayUrl,
                        original: lastQuery.originalUrl,
                        projectFallback: project?.originalImageUrl
                    });

                    // Construct result object from last query
                    // Fallback to project image if query image is missing (legacy data)
                    const fallbackImage = project?.originalImageUrl || project?.imageUrl;

                    setSegmentationResult({
                        mask: null, // We don't store base64 in Firestore
                        overlay: null,
                        original: null,
                        query: lastQuery.queryText,
                        model: lastQuery.modelUsed || 'CADFormer',
                        filename: 'project_image.png',
                        maskUrl: lastQuery.maskUrl,
                        overlayUrl: lastQuery.overlayUrl,
                        originalUrl: lastQuery.originalUrl || fallbackImage
                    });

                    // Keep query input empty for user to type new query
                    setNewQuery('');
                } else {
                    console.log('⚠️ No queries found for project, checking sessionStorage');
                    // No queries yet, check sessionStorage
                    const storedResult = sessionStorage.getItem('segmentation_result');
                    if (storedResult) {
                        const result = JSON.parse(storedResult);
                        setSegmentationResult(result);
                    } else {
                        // Redirect to new segmentation if no data
                        navigate(`/projects/${projectId}/segment`);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching last query:', error);
                // Fall back to sessionStorage
                const storedResult = sessionStorage.getItem('segmentation_result');
                if (storedResult) {
                    const result = JSON.parse(storedResult);
                    setSegmentationResult(result);
                } else {
                    navigate(`/projects/${projectId}/segment`);
                }
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchLastQuery();
    }, [projectId, navigate]);

    // Handle drag for split view slider
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !imageContainerRef.current) return;

        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSplitPosition(percentage);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

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

    // Helper to resolve image URLs (handles local uploads vs external URLs)
    const resolveImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('/uploads')) {
            return `http://localhost:5000${url}`;
        }
        // Handle legacy base64 or external URLs
        return url;
    };

    // Get image URLs from segmentation result (base64 or URL)
    const originalImageUrl = segmentationResult?.original
        ? `data:image/png;base64,${segmentationResult.original}`
        : resolveImageUrl(segmentationResult?.originalUrl);
    const overlayImageUrl = segmentationResult?.overlay
        ? `data:image/png;base64,${segmentationResult.overlay}`
        : resolveImageUrl(segmentationResult?.overlayUrl);
    const maskImageUrl = segmentationResult?.mask
        ? `data:image/png;base64,${segmentationResult.mask}`
        : resolveImageUrl(segmentationResult?.maskUrl);

    // Loading state - fetching last query
    if (isLoadingHistory) {
        return (
            <div className="min-h-full flex flex-col">
                <div className="px-4 md:px-10 lg:px-20 xl:px-40 flex flex-1 justify-center py-5">
                    <div className="flex flex-col max-w-[1400px] flex-1">
                        {/* Page Heading */}
                        <div className="flex flex-wrap items-end justify-between gap-4 p-4 mb-2">
                            <div className="flex min-w-72 flex-col gap-2">
                                <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Segmentation Results</h1>
                                <p className="text-text-muted text-base font-normal leading-normal">Loading last query...</p>
                            </div>
                        </div>

                        {/* Loading State */}
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="bg-surface-dark rounded-xl border border-border-dark p-12 text-center max-w-lg">
                                <div className="size-20 mx-auto mb-6 rounded-full bg-border-dark flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                                <h2 className="text-white text-2xl font-bold mb-3">Loading Query History</h2>
                                <p className="text-text-muted">
                                    Fetching your last query result from this project...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Empty state - no segmentation results available
    if (!segmentationResult) {
        return (
            <div className="min-h-full flex flex-col">
                <div className="px-4 md:px-10 lg:px-20 xl:px-40 flex flex-1 justify-center py-5">
                    <div className="flex flex-col max-w-[1400px] flex-1">
                        {/* Page Heading */}
                        <div className="flex flex-wrap items-end justify-between gap-4 p-4 mb-2">
                            <div className="flex min-w-72 flex-col gap-2">
                                <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Segmentation Results</h1>
                                <p className="text-text-muted text-base font-normal leading-normal">View your segmentation analysis results here</p>
                            </div>
                        </div>

                        {/* Empty State */}
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="bg-surface-dark rounded-xl border border-border-dark p-12 text-center max-w-lg">
                                <div className="size-20 mx-auto mb-6 rounded-full bg-border-dark flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-text-muted">image_search</span>
                                </div>
                                <h2 className="text-white text-2xl font-bold mb-3">No Segmentation Results</h2>
                                <p className="text-text-muted mb-8">
                                    Run a segmentation analysis to see results here. Upload an image and enter a natural language query to get started.
                                </p>
                                <Link
                                    to="/segmentation/new"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-green-900/20"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                    New Segmentation
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full flex flex-col">
            <div className="px-4 md:px-10 lg:px-20 xl:px-40 flex flex-1 justify-center py-5">
                <div className="flex flex-col max-w-[1400px] flex-1">
                    {/* Page Heading */}
                    <div className="flex flex-wrap items-end justify-between gap-4 p-4 mb-2">
                        <div className="flex min-w-72 flex-col gap-2">
                            <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Segmentation Results</h1>
                            <div className="flex flex-col gap-1">
                                <p className="text-text-muted text-base font-normal leading-normal">
                                    Query: "{segmentationResult.query}"
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <p className="text-text-muted text-sm font-normal">
                                        File: {segmentationResult.filename}
                                    </p>
                                    <div className="h-1 w-1 rounded-full bg-text-muted"></div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-base">psychology</span>
                                        <span className="text-sm font-medium text-white">
                                            Model: <span className="text-primary font-bold">{segmentationResult.model || 'CADFormer'}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                to="/segmentation/new"
                                className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary hover:bg-green-600 text-white text-sm font-bold leading-normal transition-colors shadow-[0_0_15px_rgba(50,164,90,0.3)]"
                            >
                                <span className="material-symbols-outlined mr-2 text-lg">add</span>
                                <span className="truncate">New Analysis</span>
                            </Link>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
                        {/* Left Column: Image Viewer */}
                        <div className="lg:col-span-8 flex flex-col gap-4">
                            {/* Map/Image Card */}
                            <div className="bg-surface-dark rounded-xl border border-border-dark shadow-lg overflow-hidden flex flex-col h-[600px]">
                                {/* Toolbar */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark bg-panel-dark">
                                    <div className="flex items-center gap-2">
                                        {/* Zoom Controls */}
                                        <button
                                            onClick={handleZoomIn}
                                            disabled={zoomLevel >= MAX_ZOOM}
                                            className="group relative flex items-center justify-center size-9 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined">zoom_in</span>
                                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">Zoom In</span>
                                        </button>
                                        <button
                                            onClick={handleZoomOut}
                                            disabled={zoomLevel <= MIN_ZOOM}
                                            className="group relative flex items-center justify-center size-9 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined">zoom_out</span>
                                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">Zoom Out</span>
                                        </button>
                                        <button
                                            onClick={handleResetView}
                                            disabled={zoomLevel === 1}
                                            className="group relative flex items-center justify-center size-9 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined">center_focus_strong</span>
                                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">Reset View</span>
                                        </button>
                                        {zoomLevel !== 1 && (
                                            <span className="text-xs text-white font-mono bg-border-dark px-2 py-1 rounded">
                                                {Math.round(zoomLevel * 100)}%
                                            </span>
                                        )}

                                        <div className="w-px h-4 bg-border-dark mx-1"></div>

                                        {/* Split View button temporarily hidden
                                        <button
                                            onClick={() => setViewMode('split')}
                                            className={`font-medium text-sm flex items-center gap-1 px-3 py-1.5 rounded transition-all ${viewMode === 'split'
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-text-muted hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm">compare</span>
                                            Split View
                                        </button>
                                        */}
                                        <button
                                            onClick={() => setViewMode('overlay')}
                                            className={`font-medium text-sm flex items-center gap-1 px-3 py-1.5 rounded transition-all ${viewMode === 'overlay'
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-text-muted hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm">layers</span>
                                            Overlay
                                        </button>
                                        <button
                                            onClick={() => setViewMode('mask')}
                                            className={`font-medium text-sm flex items-center gap-1 px-3 py-1.5 rounded transition-all ${viewMode === 'mask'
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-text-muted hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm">contrast</span>
                                            Mask Only
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-xs text-text-muted font-mono">
                                            {viewMode === 'split' ? 'SPLIT VIEW' : viewMode === 'overlay' ? 'OVERLAY VIEW' : 'MASK ONLY'}
                                        </span>
                                    </div>
                                </div>

                                {/* Interactive Image Area */}
                                <div
                                    ref={imageContainerRef}
                                    className="relative flex-1 w-full bg-background-dark group overflow-hidden select-none"
                                >
                                    {viewMode === 'split' ? (
                                        /* Split View Mode */
                                        <>
                                            {/* Original Image (Right side - full) */}
                                            <div
                                                className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat transition-transform duration-200 ease-out"
                                                style={{
                                                    backgroundImage: `url('${originalImageUrl}')`,
                                                    transform: `scale(${zoomLevel})`
                                                }}
                                            />

                                            {/* Segmented/Overlay Image (Left side - partial based on splitPosition) */}
                                            <div
                                                className="absolute inset-0 h-full overflow-hidden border-r-2 border-white/80 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-10 transition-[width] duration-75"
                                                style={{ width: `${splitPosition}%` }}
                                            >
                                                <div
                                                    className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-200 ease-out"
                                                    style={{
                                                        backgroundImage: `url('${overlayImageUrl}')`,
                                                        transform: `scale(${zoomLevel})`,
                                                        width: `${100 / (splitPosition / 100)}%`
                                                    }}
                                                />
                                            </div>

                                            {/* Draggable Slider Handle */}
                                            <div
                                                className="absolute inset-y-0 z-20 w-8 flex items-center justify-center cursor-ew-resize transition-transform hover:scale-110"
                                                style={{ left: `calc(${splitPosition}% - 1rem)` }}
                                                onMouseDown={handleMouseDown}
                                            >
                                                <div className="h-12 w-12 bg-white rounded-full shadow-lg flex items-center justify-center text-background-dark hover:bg-gray-100 transition-colors">
                                                    <span className="material-symbols-outlined text-xl">drag_indicator</span>
                                                </div>
                                            </div>

                                            {/* Labels */}
                                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-white z-20 border border-white/10">
                                                SEGMENTED
                                            </div>
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-white z-20 border border-white/10">
                                                ORIGINAL
                                            </div>
                                        </>
                                    ) : viewMode === 'overlay' ? (
                                        /* Overlay View Mode - show the overlay image directly */
                                        <>
                                            <div
                                                className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat transition-all duration-200 ease-out"
                                                style={{
                                                    backgroundImage: `url('${overlayImageUrl}')`,
                                                    transform: `scale(${zoomLevel})`
                                                }}
                                            />

                                            {/* Overlay label hidden
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1.5 rounded text-xs font-bold text-white z-20 border border-white/10 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">layers</span>
                                                SEGMENTATION RESULT
                                            </div>
                                            */}
                                        </>
                                    ) : viewMode === 'mask' ? (
                                        /* Mask Only View Mode - show only the target on black background */
                                        <>
                                            {/* Black background */}
                                            <div className="absolute inset-0 w-full h-full bg-black" />

                                            {/* Mask image (white = target visible) */}
                                            <div
                                                className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat transition-all duration-200 ease-out"
                                                style={{
                                                    backgroundImage: `url('${maskImageUrl}')`,
                                                    transform: `scale(${zoomLevel})`
                                                }}
                                            />

                                            {/* Mask Only label hidden
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1.5 rounded text-xs font-bold text-white z-20 border border-white/10 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">contrast</span>
                                                MASK ONLY
                                            </div>
                                            */}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Controls */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            {/* Re-Query Panel */}
                            <div className="bg-surface-dark rounded-xl border border-border-dark p-4">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">search</span>
                                    Query Segmentation
                                </h3>

                                {/* Current Query */}
                                <div className="mb-4 p-3 bg-border-dark/50 rounded-lg">
                                    <span className="text-xs text-text-muted uppercase tracking-wide">Current Query</span>
                                    <p className="text-white text-sm mt-1">"{segmentationResult.query}"</p>
                                </div>

                                {/* New Query Input */}
                                <div className="space-y-3">
                                    <label className="text-sm text-text-muted">Try a different query:</label>
                                    <textarea
                                        value={newQuery}
                                        onChange={(e) => {
                                            setNewQuery(e.target.value);
                                            setQueryError('');
                                        }}
                                        placeholder="e.g., Find the red vehicle, Segment the buildings..."
                                        className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white text-sm placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                                        rows={3}
                                        disabled={isProcessing}
                                    />

                                    {queryError && (
                                        <p className="text-red-400 text-xs flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            {queryError}
                                        </p>
                                    )}

                                    <button
                                        onClick={runNewQuery}
                                        disabled={isProcessing || !newQuery.trim()}
                                        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-primary hover:bg-green-600 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold transition-all shadow-lg shadow-green-900/20"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">play_arrow</span>
                                                Run New Query
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Download Actions */}
                            <div className="flex flex-col gap-3 mt-auto">
                                <a
                                    href={overlayImageUrl}
                                    download="segmentation_overlay.png"
                                    className="w-full flex items-center justify-center gap-2 h-12 rounded-lg bg-primary hover:bg-green-600 text-white font-bold transition-all shadow-lg shadow-green-900/20"
                                >
                                    <span className="material-symbols-outlined">download</span>
                                    Download Overlay
                                </a>
                                <div className="grid grid-cols-2 gap-3">
                                    <a
                                        href={`data:image/png;base64,${segmentationResult.mask}`}
                                        download="segmentation_mask.png"
                                        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-sky-blue/10 border border-sky-blue/20 hover:bg-sky-blue/20 text-sky-blue font-medium transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg">image</span>
                                        Mask
                                    </a>
                                    <a
                                        href={originalImageUrl}
                                        download="original.png"
                                        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-sky-blue/10 border border-sky-blue/20 hover:bg-sky-blue/20 text-sky-blue font-medium transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg">photo</span>
                                        Original
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsPage;
