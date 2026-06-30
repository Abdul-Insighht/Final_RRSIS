import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const AdminSidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { adminLogout } = useAdminAuth();

    const navItems = [
        { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/admin/users', icon: 'group', label: 'User Management' },
        { path: '/admin/models', icon: 'model_training', label: 'Model Management' },
        { path: '/admin/activity', icon: 'monitoring', label: 'Activity Monitoring' },
        { path: '/admin/system', icon: 'settings', label: 'System Configuration' },
    ];

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

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
                    <Link to="/admin/dashboard" className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
                        <span className="text-xl font-bold tracking-tight text-white">Admin</span>
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
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-border-dark">
                    <button
                        onClick={() => {
                            adminLogout();
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

export default AdminSidebar;
