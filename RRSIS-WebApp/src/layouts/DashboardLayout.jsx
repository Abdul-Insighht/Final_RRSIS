import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import PaymentModal from '../components/common/PaymentModal';

// Map routes to page titles
const getPageTitle = (pathname) => {
    const routeTitles = {
        '/dashboard': 'Dashboard',
        '/segmentation/new': 'New Segmentation',
        '/projects': 'My Projects',
        '/results': 'Results',
        '/settings': 'Settings',
    };

    // Exact match first
    if (routeTitles[pathname]) {
        return routeTitles[pathname];
    }

    // Check for partial matches (for nested routes like /results/123)
    for (const [route, title] of Object.entries(routeTitles)) {
        if (pathname.startsWith(route + '/') || pathname.startsWith(route)) {
            return title;
        }
    }

    return 'Dashboard';
};

const DashboardLayout = () => {
    const { user, isLoading } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const pageTitle = getPageTitle(location.pathname);

    useEffect(() => {
        const handleOpenPayment = () => setIsPaymentModalOpen(true);
        window.addEventListener('OPEN_PAYMENT_MODAL', handleOpenPayment);
        return () => window.removeEventListener('OPEN_PAYMENT_MODAL', handleOpenPayment);
    }, []);

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

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.emailVerified) {
        return <Navigate to="/verify-email" replace />;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark text-white">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative cybernetic-grid">
                <Header onMenuClick={() => setSidebarOpen(true)} pageTitle={pageTitle} />

                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
            <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />
        </div>
    );
};

export default DashboardLayout;
