import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProjects, getEnabledModels } from '../firebase/firestore';

const DashboardPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;

            setIsLoading(true);

            try {
                // Fetch user's projects
                const userProjects = await getUserProjects(user.uid);
                setProjects(userProjects);

                // Fetch enabled models count
                const enabledModels = await getEnabledModels();
                const availableModelsCount = enabledModels.length;

                // Calculate stats from projects
                const totalProjects = userProjects.length;
                const totalQueries = userProjects.reduce((sum, p) => sum + (p.queryCount || 0), 0);

                const formattedStats = [
                    {
                        icon: 'folder_special',
                        label: 'Total Projects',
                        value: `${totalProjects}`,
                        color: 'primary'
                    },
                    {
                        icon: 'polyline',
                        label: 'Total Queries',
                        value: `${totalQueries}`,
                        color: 'purple-500'
                    },
                    {
                        icon: 'model_training',
                        label: 'Available Models',
                        value: `${availableModelsCount}`,
                        badge: availableModelsCount > 0 ? 'Ready to use' : null,
                        color: 'secondary'
                    },
                    {
                        icon: 'cloud',
                        label: 'Storage Used',
                        value: '0',
                        unit: '/ 100 GB',
                        progress: 0,
                        color: 'orange-500'
                    }
                ];

                setStats(formattedStats);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                // Show zeros on error
                setStats([
                    { icon: 'folder_special', label: 'Total Projects', value: '0', color: 'primary' },
                    { icon: 'polyline', label: 'Total Queries', value: '0', color: 'purple-500' },
                    { icon: 'model_training', label: 'Available Models', value: '0', color: 'secondary' },
                    { icon: 'cloud', label: 'Storage Used', value: '0', unit: '/ 100 GB', progress: 0, color: 'orange-500' }
                ]);
                setProjects([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    // Helper function to safely format timestamps
    const formatTimestamp = (timestamp) => {
        try {
            if (!timestamp) return 'N/A';
            if (timestamp.seconds) {
                // Firestore Timestamp
                return new Date(timestamp.seconds * 1000).toLocaleDateString();
            } else if (timestamp instanceof Date) {
                return timestamp.toLocaleDateString();
            } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
                return new Date(timestamp).toLocaleDateString();
            }
            return 'N/A';
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return 'N/A';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Completed
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse"></span>
                        Processing
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                        Failed
                    </span>
                );
            case 'active':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                        Active
                    </span>
                );
        }
    };

    // Empty state for new users
    const EmptyState = ({ title, description, icon }) => (
        <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-text-muted mb-4">{description}</p>
            <Link
                to="/segmentation/new"
                className="flex items-center gap-2 bg-primary hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
                <span className="material-symbols-outlined text-lg">add</span>
                Start Your First Segmentation
            </Link>
        </div>
    );

    console.log('DashboardPage render - isLoading:', isLoading, 'projects:', projects.length, 'stats:', stats.length);

    if (isLoading) {
        console.log('Showing loading state');
        return (
            <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                    <p className="text-text-muted">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    console.log('Rendering dashboard content');

    return (
        <div className="p-4 md:p-8 bg-background-dark min-h-screen">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user?.name?.split(' ')[0] || 'Analyst'}</h1>
                        <p className="text-text-muted">Here is the latest update on your remote sensing operations.</p>
                    </div>
                    <button
                        onClick={() => navigate('/segmentation/new')}
                        className="flex items-center gap-2 bg-primary hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        New Project
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="bg-surface-dark p-6 rounded-xl border border-border-dark shadow-sm flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className={`p-2 bg-${stat.color}/10 rounded-lg text-${stat.color}`}>
                                    <span className="material-symbols-outlined">{stat.icon}</span>
                                </div>
                                {stat.trend && (
                                    <span className={`text-xs font-medium ${stat.trendUp ? 'text-green-500' : 'text-red-500'} flex items-center gap-1`}>
                                        <span className="material-symbols-outlined text-sm">{stat.trendUp ? 'trending_up' : 'trending_down'}</span>
                                        {stat.trend}
                                    </span>
                                )}
                                {stat.badge && (
                                    <span className="text-xs font-medium text-text-muted">{stat.badge}</span>
                                )}
                            </div>
                            <div>
                                <p className="text-text-muted text-sm font-medium mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-white">
                                    {stat.value}
                                    {stat.unit && <span className="text-sm font-normal text-text-muted">{stat.unit}</span>}
                                </h3>
                                {stat.progress !== undefined && (
                                    <div className="w-full bg-border-dark rounded-full h-1.5 mt-2">
                                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${stat.progress}%` }}></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Map and Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Project Locations Map */}
                    <div className="lg:col-span-1 bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-border-dark">
                            <h3 className="font-semibold text-white">Segmentation On</h3>
                        </div>
                        <div className="relative flex-1 min-h-[300px] bg-slate-800">
                            {projects.length > 0 ? (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center opacity-80 transition-transform duration-300 hover:scale-105"
                                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBoQB774HgUZFWtzzinaHPkQOxciCnayt2VAgg5jrAuEVljo_EtEt_urqepPMLjx_Rky1YM_z43lsYgOnInK10FXnu4Ac1o9qvZFxguf3jQXcgMB_E5_O7NnWQdzBkrC7BWOoD5nJ442wMR1DFesu6cc_xNbJu2gh3_OQJs0eiz4D3qbUuBLfIC6FMYtcAb5HKtALd1bFl0JbJlVr7XnHfV3KK1_9SM8mna6z0LoqoqaJglqAhDE31XpVFYNexs1jYNDH-T_A0s43WJ')" }}
                                    />
                                    <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm p-3 rounded-lg border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-secondary animate-pulse"></div>
                                            <p className="text-xs text-white">Processing region: <span className="font-bold">Aerial / Satellite Image</span></p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center p-4">
                                        <span className="material-symbols-outlined text-text-muted text-4xl mb-2">map</span>
                                        <p className="text-text-muted text-sm">No project locations yet</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Projects Table */}
                    <div className="lg:col-span-2 bg-surface-dark rounded-xl border border-border-dark shadow-sm flex flex-col">
                        <div className="p-4 border-b border-border-dark flex justify-between items-center">
                            <h3 className="font-semibold text-white">Recent Projects</h3>
                            <Link to="/projects" className="text-primary hover:text-green-400 text-sm font-medium">View All</Link>
                        </div>

                        {projects.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Project Name</th>
                                            <th className="px-6 py-4">Queries</th>
                                            <th className="px-6 py-4">Last Updated</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-dark text-slate-300">
                                        {projects.slice(0, 5).map((project) => (
                                            <tr key={project.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-slate-700 overflow-hidden shrink-0">
                                                        {project.imageUrl ? (
                                                            <div
                                                                className="w-full h-full bg-cover bg-center"
                                                                style={{ backgroundImage: `url('${project.imageUrl}')` }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-gray-500 text-sm">image</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {project.name}
                                                </td>
                                                <td className="px-6 py-4">{project.queryCount || 0} queries</td>
                                                <td className="px-6 py-4">
                                                    {formatTimestamp(project.updatedAt)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link
                                                        to={`/projects/${project.id}`}
                                                        className="text-text-muted hover:text-primary transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState
                                title="No Projects Yet"
                                description="Create your first project to start running segmentation queries."
                                icon="folder_open"
                            />
                        )}
                    </div>
                </div>


            </div>
        </div>
    );
};

export default DashboardPage;
