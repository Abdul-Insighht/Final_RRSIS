import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getSystemStats } from '../../firebase/firestore_admin';
import { auth } from '../../firebase/config';

const AdminDashboardPage = () => {
    const { admin, isAdmin } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [storageUsed, setStorageUsed] = useState('0 MB');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!isAdmin) return;

            setIsLoading(true);
            try {
                // Fetch system stats
                const systemStats = await getSystemStats();
                setStats(systemStats);

                // Fetch storage usage from backend
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const token = await currentUser.getIdToken();
                    const response = await fetch('http://localhost:5000/api/admin/system/storage', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const sizeMB = data.storageUsedMB || 0;
                        setStorageUsed(sizeMB < 1024 ? `${sizeMB} MB` : `${(sizeMB / 1024).toFixed(2)} GB`);
                    }
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
            setIsLoading(false);
        };

        fetchStats();
    }, [isAdmin]);

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                    <p className="text-text-muted">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            label: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: 'group',
            color: 'primary',
        },
        {
            label: 'Active Users',
            value: stats?.activeUsers || 0,
            icon: 'person_check',
            color: 'secondary',
        },
        {
            label: 'Total Projects',
            value: stats?.totalProjects || 0,
            icon: 'folder_open',
            color: 'sky-blue',
        },
        {
            label: 'Total Queries',
            value: stats?.totalQueries || 0,
            icon: 'query_stats',
            color: 'primary',
        },
        {
            label: 'Total Credits',
            value: stats?.totalCredits || 0,
            icon: 'account_balance_wallet',
            color: 'secondary',
        },
        {
            label: 'Total Models',
            value: stats?.totalModels || 0,
            icon: 'model_training',
            color: 'sky-blue',
        },
        {
            label: 'Enabled Models',
            value: stats?.enabledModels || 0,
            icon: 'check_circle',
            color: 'primary',
        },
        {
            label: 'Storage Used',
            value: storageUsed,
            icon: 'storage',
            color: 'secondary',
            isText: true,
        },
    ];

    const quickActions = [
        {
            title: 'Manage Users',
            description: 'View and manage user accounts',
            icon: 'group',
            link: '/admin/users',
            color: 'primary'
        },
        {
            title: 'Manage Models',
            description: 'Configure segmentation models',
            icon: 'model_training',
            link: '/admin/models',
            color: 'secondary'
        },
        {
            title: 'Activity Logs',
            description: 'Monitor system activity',
            icon: 'timeline',
            link: '/admin/activity',
            color: 'sky-blue'
        },
        {
            title: 'System Configuration',
            description: 'Configure system settings',
            icon: 'settings',
            link: '/admin/system',
            color: 'primary'
        },
    ];

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Welcome, {admin?.name || 'Administrator'}</h1>
                        <p className="text-text-muted">System administration and management dashboard</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat, index) => (
                        <div key={index} className="bg-surface-dark p-6 rounded-xl border border-border-dark shadow-sm flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className={`p-2 bg-${stat.color}/10 rounded-lg text-${stat.color}`}>
                                    <span className="material-symbols-outlined">{stat.icon}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-muted text-sm font-medium mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div>
                    <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {quickActions.map((action, index) => (
                            <Link
                                key={index}
                                to={action.link}
                                className="bg-surface-dark p-6 rounded-xl border border-border-dark hover:border-primary/50 transition-all shadow-sm flex flex-col gap-3 group"
                            >
                                <div className={`w-12 h-12 rounded-lg bg-${action.color}/10 flex items-center justify-center text-${action.color} group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined text-2xl">{action.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white mb-1">{action.title}</h3>
                                    <p className="text-sm text-text-muted">{action.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-4 pb-8 flex flex-col md:flex-row justify-between text-xs text-text-muted gap-4">
                    <p>© 2024 GeoSegAI Admin. All rights reserved.</p>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-primary">System Logs</a>
                        <a href="#" className="hover:text-primary">Documentation</a>
                        <a href="#" className="hover:text-primary">Support</a>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default AdminDashboardPage;
