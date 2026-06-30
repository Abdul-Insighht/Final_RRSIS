import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { logout } = useAuth();

    // Extract projectId from current URL if we're in a project context
    const projectId = useMemo(() => {
        const match = location.pathname.match(/^\/projects\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    // Context-aware navigation items
    const navItems = useMemo(() => [
        { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/segmentation/new', icon: 'add_circle', label: 'New Segmentation' },
        { path: '/projects', icon: 'folder_open', label: 'My Projects' },
        { path: '/billing', icon: 'receipt_long', label: 'Billing & Credits' },
        {
            path: projectId ? `/projects/${projectId}/results` : '/results',
            icon: 'table_chart',
            label: 'Results'
        },
    ], [projectId]);

    // Route-specific active state matching
    const isActive = (path) => {
        const pathname = location.pathname;

        // Exact match
        if (pathname === path) return true;

        // Special handling for each route
        switch (path) {
            case '/dashboard':
                return pathname === '/dashboard';

            case '/segmentation/new':
                // Match /segmentation/new and /projects/:id/segment
                return pathname === '/segmentation/new' ||
                    pathname.match(/^\/projects\/[^/]+\/segment$/);

            case '/projects':
                // Only match /projects and /projects/:id (detail page)
                // NOT /projects/:id/segment or /projects/:id/results
                return pathname === '/projects' ||
                    pathname.match(/^\/projects\/[^/]+$/);

            default:
                // For Results link (which can be /results or /projects/:id/results)
                if (path === '/results' || path.match(/^\/projects\/[^/]+\/results$/)) {
                    return pathname === '/results' ||
                        pathname.match(/^\/projects\/[^/]+\/results$/);
                }
                // Default fallback
                return pathname.startsWith(path + '/');
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 flex flex-col
        bg-background-dark border-r border-border-dark
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                {/* Logo */}
                <div className="flex h-16 items-center px-6 border-b border-border-dark">
                    <Link to="/dashboard" className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-3xl">satellite_alt</span>
                        <span className="text-xl font-bold tracking-tight text-white">GeoSegAI</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive(item.path)
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-text-muted hover:bg-white/5 hover:text-white'}
              `}
                        >
                            <span className={`material-symbols-outlined ${isActive(item.path) ? 'text-primary' : ''}`}>
                                {item.icon}
                            </span>
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    ))}

                    <div className="my-2 border-t border-border-dark" />

                    <Link
                        to="/settings"
                        onClick={onClose}
                        className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
              ${isActive('/settings')
                                ? 'bg-primary/10 text-primary'
                                : 'text-text-muted hover:bg-white/5 hover:text-white'}
            `}
                    >
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-sm font-medium">Settings</span>
                    </Link>
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-border-dark">
                    <button
                        onClick={() => {
                            logout();
                            onClose();
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
