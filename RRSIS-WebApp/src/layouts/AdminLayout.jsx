import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminSidebar from '../components/admin/AdminSidebar';
import Header from '../components/common/Header';

// Map routes to page titles
const getPageTitle = (pathname) => {
    const routeTitles = {
        '/admin/dashboard': 'Admin Dashboard',
        '/admin/users': 'User Management',
        '/admin/models': 'Model Management',
        '/admin/activity': 'Activity Monitoring',
        '/admin/system': 'System Configuration',
    };

    // Exact match first
    if (routeTitles[pathname]) {
        return routeTitles[pathname];
    }

    // Check for partial matches
    for (const [route, title] of Object.entries(routeTitles)) {
        if (pathname.startsWith(route + '/') || pathname.startsWith(route)) {
            return title;
        }
    }

    return 'Admin Dashboard';
};

const AdminLayout = () => {
    const { admin, isLoading, isAdmin } = useAdminAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pageTitle = getPageTitle(location.pathname);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex items-center gap-3 text-primary">
                    <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                    <span className="text-xl font-medium text-white">Loading...</span>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/admin/login" replace />;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark text-white">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative cybernetic-grid">
                <Header onMenuClick={() => setSidebarOpen(true)} pageTitle={pageTitle} hideCredits={true} />

                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
