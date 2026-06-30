import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getActivityLogs } from '../../firebase/firestore_admin';

const ActivityMonitoringPage = () => {
    const { isAdmin } = useAdminAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');
    const [limit, setLimit] = useState(50);

    const fetchLogs = async () => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const activityLogs = await getActivityLogs({
                limit,
                type: typeFilter
            });
            setLogs(activityLogs);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [isAdmin, typeFilter, limit]);

    const getTypeIcon = (type) => {
        const icons = {
            'user_login': 'login',
            'user_signup': 'person_add',
            'project_created': 'create_new_folder',
            'query_executed': 'search',
            'credit_used': 'payments',
            'model_changed': 'model_training',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        return icons[type] || 'circle';
    };

    const getTypeColor = (type) => {
        const colors = {
            'user_login': 'text-blue-400',
            'user_signup': 'text-green-400',
            'project_created': 'text-purple-400',
            'query_executed': 'text-sky-blue',
            'credit_used': 'text-yellow-400',
            'model_changed': 'text-primary',
            'error': 'text-red-500',
            'warning': 'text-orange-400',
            'info': 'text-gray-400'
        };
        return colors[type] || 'text-gray-400';
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Activity Monitoring</h1>
                        <p className="text-text-muted">System activity logs (30-day retention)</p>
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">refresh</span>
                        Refresh
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-surface-dark p-4 rounded-xl border border-border-dark flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-white mb-2">Activity Type</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white focus:border-primary focus:ring-primary text-sm h-10 px-4"
                        >
                            <option value="all">All Activities</option>
                            <option value="user_login">User Logins</option>
                            <option value="user_signup">User Signups</option>
                            <option value="project_created">Projects Created</option>
                            <option value="query_executed">Queries Executed</option>
                            <option value="credit_used">Credits Used</option>
                            <option value="model_changed">Model Changes</option>
                            <option value="error">Errors</option>
                            <option value="warning">Warnings</option>
                        </select>
                    </div>
                    <div className="md:w-48">
                        <label className="block text-sm font-medium text-white mb-2">Limit</label>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white focus:border-primary focus:ring-primary text-sm h-10 px-4"
                        >
                            <option value={25}>25 logs</option>
                            <option value={50}>50 logs</option>
                            <option value={100}>100 logs</option>
                            <option value={200}>200 logs</option>
                        </select>
                    </div>
                </div>

                {/* Activity Logs */}
                <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                    {/* Stats Header */}
                    <div className="px-6 py-3 bg-white/5 border-b border-border-dark">
                        <p className="text-sm text-text-muted">
                            Showing <span className="text-white font-semibold">{logs.length}</span> recent activities
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                            No activity logs found
                        </div>
                    ) : (
                        <div className="divide-y divide-border-dark">
                            {logs.map((log, index) => (
                                <div key={log.id || index} className="px-6 py-4 hover:bg-white/5 transition-colors flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`p-2 rounded-lg bg-white/5 ${getTypeColor(log.type)}`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {getTypeIcon(log.type)}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-white font-medium mb-1">
                                                    {log.message || log.action || 'Activity logged'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                                                    {log.userId && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">person</span>
                                                            {log.userName || log.userId}
                                                        </span>
                                                    )}
                                                    {log.type && (
                                                        <span className="px-2 py-0.5 rounded bg-white/5 text-xs">
                                                            {log.type}
                                                        </span>
                                                    )}
                                                </div>
                                                {log.details && (
                                                    <p className="text-sm text-text-muted mt-2">
                                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-xs text-text-muted whitespace-nowrap">
                                                {formatTimestamp(log.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-blue-400 text-xl">info</span>
                    <div className="flex-1">
                        <p className="text-sm text-blue-400 font-medium mb-1">Automatic Log Cleanup</p>
                        <p className="text-sm text-blue-300/80">
                            Activity logs are automatically deleted after 30 days to maintain system performance and comply with data retention policies.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityMonitoringPage;
