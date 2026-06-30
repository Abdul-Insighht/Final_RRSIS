import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';

const SettingsPage = () => {
    const { user, userProfile, updateUser, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { notificationsEnabled, toggleNotifications } = useNotifications();

    // Profile form state
    const [formData, setFormData] = useState({
        fullName: userProfile?.name || user?.displayName || user?.name || '',
        email: user?.email || '',
        organization: userProfile?.organization || user?.organization || '',
        userType: userProfile?.userType || 'researcher'
    });
    const [isSaving, setIsSaving] = useState(false);

    // Usage statistics state
    const [stats, setStats] = useState({
        projectCount: 0,
        queryCount: 0,
        credits: userProfile?.credits || 0,
        memberSince: user?.metadata?.creationTime || null
    });
    const [loadingStats, setLoadingStats] = useState(true);

    // Password change modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Delete account modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Delete all projects modal state
    const [showDeleteProjectsModal, setShowDeleteProjectsModal] = useState(false);
    const [deleteProjectsConfirmText, setDeleteProjectsConfirmText] = useState('');
    const [deleteProjectsError, setDeleteProjectsError] = useState('');
    const [deletingProjects, setDeletingProjects] = useState(false);


    // Fetch usage statistics
    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.uid) return;

            setLoadingStats(true);
            try {
                // Read cached stats from user profile (much faster than calculating)
                setStats({
                    projectCount: userProfile?.totalProjects || 0,
                    queryCount: userProfile?.totalQueries || 0,
                    credits: userProfile?.credits || 0,
                    memberSince: user?.metadata?.creationTime || null
                });

                console.log('📊 SettingsPage: Loaded cached stats from user profile');
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
            setLoadingStats(false);
        };

        fetchStats();
    }, [user, userProfile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        updateUser({
            name: formData.fullName,
            organization: formData.organization,
            userType: formData.userType
        });
        setIsSaving(false);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        setChangingPassword(true);
        try {
            // Re-authenticate user
            const credential = EmailAuthProvider.credential(
                user.email,
                passwordData.currentPassword
            );
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, passwordData.newPassword);

            setPasswordSuccess('Password changed successfully!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

            setTimeout(() => {
                setShowPasswordModal(false);
                setPasswordSuccess('');
            }, 2000);
        } catch (error) {
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Current password is incorrect');
            } else {
                setPasswordError(error.message);
            }
        }
        setChangingPassword(false);
    };

    const handleExportData = async () => {
        try {
            // Fetch all user data
            const projectsRef = collection(db, 'projects');
            const projectsQuery = query(projectsRef, where('userId', '==', user.uid));
            const projectsSnapshot = await getDocs(projectsQuery);

            const projects = [];

            // Get all projects with queries
            for (const projectDoc of projectsSnapshot.docs) {
                const projectData = projectDoc.data();
                const queriesRef = collection(db, 'projects', projectDoc.id, 'queries');
                const queriesSnapshot = await getDocs(queriesRef);

                projects.push({
                    ...projectData,
                    queries: queriesSnapshot.docs.map(q => q.data())
                });
            }

            // Generate beautiful HTML report
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeoSegAI Data Export - ${formData.fullName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; padding: 40px 20px; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        h1 { color: #10b981; font-size: 2.5rem; margin-bottom: 10px; display: flex; align-items: center; gap: 15px; }
        h2 { color: #10b981; font-size: 1.8rem; margin: 40px 0 20px; border-bottom: 3px solid #10b981; padding-bottom: 12px; display: flex; align-items: center; gap: 10px; }
        h3 { color: #34d399; font-size: 1.3rem; margin: 25px 0 15px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px; color: white; }
        .header p { opacity: 0.9; margin-top: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 25px 0; }
        .info-item { background: #0f172a; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981; transition: transform 0.2s; }
        .info-item:hover { transform: translateY(-2px); }
        .info-label { color: #94a3b8; font-size: 0.875rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { color: #e2e8f0; font-size: 1.2rem; font-weight: 600; }
        .project-card { background: #0f172a; padding: 30px; border-radius: 12px; margin-bottom: 25px; border: 2px solid #334155; transition: border-color 0.3s; }
        .project-card:hover { border-color: #10b981; }
        .query-card { background: #1e293b; padding: 18px; border-radius: 10px; margin: 12px 0; border-left: 4px solid #34d399; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; margin-right: 10px; margin-bottom: 8px; }
        .badge-primary { background: #10b981; color: #fff; }
        .badge-secondary { background: #334155; color: #94a3b8; }
        .timestamp { color: #64748b; font-size: 0.875rem; margin-top: 8px; }
        .no-data { text-align: center; padding: 60px 20px; color: #64748b; font-style: italic; font-size: 1.1rem; }
        .footer { margin-top: 50px; padding: 25px; background: #0f172a; border-radius: 12px; text-align: center; color: #64748b; border-top: 3px solid #10b981; }
        .footer p { margin: 5px 0; }
        @media print { body { background: white; color: black; } .container { box-shadow: none; } }
        @media (max-width: 768px) { .container { padding: 20px; } h1 { font-size: 2rem; } h2 { font-size: 1.5rem; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 GeoSegAI Data Export</h1>
            <p>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
        </div>

        <h2>👤 User Profile</h2>
        <div class="info-grid">
            <div class="info-item"><div class="info-label">Full Name</div><div class="info-value">${formData.fullName}</div></div>
            <div class="info-item"><div class="info-label">Email Address</div><div class="info-value">${user.email}</div></div>
            <div class="info-item"><div class="info-label">Organization</div><div class="info-value">${formData.organization || 'Not specified'}</div></div>
            <div class="info-item"><div class="info-label">User Type</div><div class="info-value">${formData.userType.charAt(0).toUpperCase() + formData.userType.slice(1)}</div></div>
            <div class="info-item"><div class="info-label">Credits Remaining</div><div class="info-value" style="color: #10b981;">${stats.credits}</div></div>
            <div class="info-item"><div class="info-label">Member Since</div><div class="info-value">${formatDate(stats.memberSince)}</div></div>
        </div>

        <h2>📁 Projects Summary</h2>
        <div class="info-grid">
            <div class="info-item"><div class="info-label">Total Projects</div><div class="info-value">${projects.length}</div></div>
            <div class="info-item"><div class="info-label">Total Queries</div><div class="info-value">${projects.reduce((sum, p) => sum + (p.queries?.length || 0), 0)}</div></div>
        </div>

        <h2>📂 Detailed Projects</h2>
        ${projects.length === 0 ? '<div class="no-data">No projects found in your account</div>' : projects.map((project, idx) => `
            <div class="project-card">
                <h3>${idx + 1}. ${project.name || 'Untitled Project'}</h3>
                <p style="color: #94a3b8; margin: 12px 0 18px; line-height: 1.6;">${project.description || 'No description provided'}</p>
                <div>
                    <span class="badge badge-primary">${project.queries?.length || 0} Queries</span>
                    <span class="badge badge-secondary">Created: ${project.createdAt ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                </div>
                
                ${project.queries && project.queries.length > 0 ? `
                    <h4 style="color: #34d399; margin: 25px 0 15px; font-size: 1.1rem;">📝 Queries in this project:</h4>
                    ${project.queries.map((query, qIdx) => `
                        <div class="query-card">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <strong style="color: #10b981;">Query ${qIdx + 1}</strong>
                                <span class="timestamp">${query.timestamp ? new Date(query.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</span>
                            </div>
                            <p style="color: #e2e8f0; line-height: 1.5; margin-top: 8px;">${query.query || query.text || 'No query text available'}</p>
                        </div>
                    `).join('')}
                ` : '<p style="color: #64748b; font-style: italic; margin-top: 15px;">No queries in this project yet</p>'}
            </div>
        `).join('')}

        <div class="footer">
            <p style="font-size: 1.1rem; margin-bottom: 10px; color: #94a3b8;">🎯 GeoSegAI - Advanced Segmentation Platform</p>
            <p>This data export contains all your projects and queries as of ${new Date().toLocaleDateString()}</p>
            <p style="margin-top: 10px; font-size: 0.875rem;">💡 Tip: You can print this page (Ctrl+P) or save it as PDF for your records</p>
        </div>
    </div>
</body>
</html>`;

            // Download as HTML file
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `GeoSegAI-Export-${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Failed to export data. Please try again.');
        }
    };


    const handleDeleteAccount = async (e) => {
        e.preventDefault();
        setDeleteError('');

        if (deleteConfirmText !== 'DELETE') {
            setDeleteError('Please type DELETE to confirm');
            return;
        }

        setDeleting(true);
        try {
            // Re-authenticate
            const credential = EmailAuthProvider.credential(
                user.email,
                deleteConfirmPassword
            );
            await reauthenticateWithCredential(user, credential);

            // Delete user account
            await deleteUser(user);

            // Logout will be automatic after account deletion
        } catch (error) {
            if (error.code === 'auth/wrong-password') {
                setDeleteError('Password is incorrect');
            } else {
                setDeleteError(error.message);
            }
            setDeleting(false);
        }
    };

    const handleDeleteAllProjects = async (e) => {
        e.preventDefault();
        setDeleteProjectsError('');

        if (deleteProjectsConfirmText !== 'DELETE') {
            setDeleteProjectsError('Please type DELETE to confirm');
            return;
        }

        setDeletingProjects(true);
        try {
            // Fetch all user projects
            const projectsRef = collection(db, 'projects');
            const projectsQuery = query(projectsRef, where('userId', '==', user.uid));
            const projectsSnapshot = await getDocs(projectsQuery);

            // Delete all projects and their subcollections
            const deletePromises = projectsSnapshot.docs.map(async (projectDoc) => {
                // Delete all queries in this project
                const queriesRef = collection(db, 'projects', projectDoc.id, 'queries');
                const queriesSnapshot = await getDocs(queriesRef);

                const queryDeletePromises = queriesSnapshot.docs.map(queryDoc =>
                    queryDoc.ref.delete()
                );
                await Promise.all(queryDeletePromises);

                // Delete the project itself
                await projectDoc.ref.delete();
            });

            await Promise.all(deletePromises);

            // Refresh stats
            setStats(prev => ({
                ...prev,
                projectCount: 0,
                queryCount: 0
            }));

            setDeleteProjectsConfirmText('');
            setShowDeleteProjectsModal(false);

            // Show success message
            alert('All projects deleted successfully!');
        } catch (error) {
            console.error('Error deleting projects:', error);
            setDeleteProjectsError('Failed to delete projects. Please try again.');
        }
        setDeletingProjects(false);
    };


    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:px-12 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                {/* Breadcrumb & Title */}
                <div className="space-y-4">
                    <nav className="flex items-center gap-2 text-sm font-medium text-text-muted">
                        <a href="/dashboard" className="hover:text-primary transition-colors">Home</a>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        <span className="text-white">Settings</span>
                    </nav>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-white mb-2">Settings</h1>
                        <p className="text-text-muted text-base">Manage your profile, security, and application preferences.</p>
                    </div>
                </div>

                {/* Profile Management */}
                <section className="bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden">
                    <div className="p-6 border-b border-border-dark">
                        <h2 className="text-xl font-bold font-display text-white">Profile Management</h2>
                    </div>
                    <div className="p-6 space-y-8">
                        {/* Avatar */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="relative group">
                                <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center ring-4 ring-border-dark">
                                    <span className="text-primary font-bold text-2xl">
                                        {formData.fullName.split(' ').map(n => n[0]).join('')}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold font-display text-white">{formData.fullName}</h3>
                                <p className="text-text-muted text-sm mb-3">
                                    {formData.userType ? formData.userType.charAt(0).toUpperCase() + formData.userType.slice(1) : 'User'}
                                </p>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300" htmlFor="fullName">Full Name</label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300" htmlFor="email">Email Address <span className="text-xs text-text-muted ml-2">(Read-only)</span></label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    readOnly
                                    disabled
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-text-muted cursor-not-allowed opacity-70 focus:outline-none"
                                    title="Email address cannot be changed"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300" htmlFor="userType">Category</label>
                                <select
                                    id="userType"
                                    name="userType"
                                    value={formData.userType}
                                    onChange={handleChange}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                >
                                    <option value="researcher">Researcher</option>
                                    <option value="student">Student</option>
                                    <option value="professional">Professional</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300" htmlFor="organization">Organization</label>
                                <input
                                    id="organization"
                                    name="organization"
                                    type="text"
                                    value={formData.organization}
                                    onChange={handleChange}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Account Security */}
                <section className="bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden">
                    <div className="p-6 border-b border-border-dark">
                        <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">lock</span>
                            Account Security
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-white">Password</p>
                                <p className="text-sm text-text-muted">Change your account password</p>
                            </div>
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                className="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white font-medium transition-all text-sm"
                            >
                                Change Password
                            </button>
                        </div>
                    </div>
                </section>

                {/* Usage Statistics & Data Privacy */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Usage Statistics */}
                    <section className="bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-border-dark">
                            <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                                <span className="material-symbols-outlined">analytics</span>
                                Usage Statistics
                            </h2>
                        </div>
                        <div className="p-6 flex-1">
                            {loadingStats ? (
                                <div className="flex justify-center py-8">
                                    <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted">Total Projects</span>
                                        <span className="text-2xl font-bold text-white">{stats.projectCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted">Total Queries</span>
                                        <span className="text-2xl font-bold text-white">{stats.queryCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted">Credits Remaining</span>
                                        <span className="text-2xl font-bold text-primary">{stats.credits}</span>
                                    </div>
                                    <div className="pt-4 border-t border-border-dark">
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-muted text-sm">Member Since</span>
                                            <span className="text-sm text-white">{formatDate(stats.memberSince)}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-text-muted text-sm">Current Sign-in</span>
                                            <span className="text-sm text-white">
                                                {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: 'numeric',
                                                    minute: 'numeric',
                                                    hour12: true
                                                }) : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Data & Privacy */}
                    <section className="bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-border-dark">
                            <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                                <span className="material-symbols-outlined">shield</span>
                                Data & Privacy
                            </h2>
                        </div>
                        <div className="p-6 flex-1 space-y-6">
                            <div>
                                <p className="font-medium text-white mb-2">Delete All Projects</p>
                                <p className="text-sm text-text-muted mb-4">Permanently delete all your projects and queries</p>
                                <button
                                    onClick={() => setShowDeleteProjectsModal(true)}
                                    className="w-full py-2.5 rounded-lg border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 font-medium transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[20px]">folder_delete</span>
                                    Delete All Projects
                                </button>
                            </div>

                            <div className="pt-4 border-t border-border-dark">
                                <p className="font-medium text-white mb-2">Delete Account</p>
                                <p className="text-sm text-text-muted mb-4">Permanently delete your account and all data</p>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="w-full py-2.5 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 font-medium transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Application Preferences */}
                <section className="bg-surface-dark rounded-xl shadow-sm border border-border-dark overflow-hidden">
                    <div className="p-6 border-b border-border-dark">
                        <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">tune</span>
                            Application Preferences
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Theme */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-white">Theme</p>
                                <p className="text-sm text-text-muted">Customize your interface appearance</p>
                            </div>
                            <div className="flex bg-background-dark p-1 rounded-lg">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${theme === 'light' ? 'bg-panel-dark shadow-sm text-white' : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    Light
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-panel-dark shadow-sm text-primary' : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    Dark
                                </button>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-white">Show Notifications</p>
                                <p className="text-sm text-text-muted">Display notification bell icon in header</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationsEnabled}
                                    onChange={(e) => toggleNotifications(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-border-dark peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                </section>

            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-dark rounded-xl border border-border-dark w-full max-w-md">
                        <div className="p-6 border-b border-border-dark flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Change Password</h3>
                            <button onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                            {passwordError && (
                                <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm">
                                    {passwordError}
                                </div>
                            )}
                            {passwordSuccess && (
                                <div className="p-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-sm">
                                    {passwordSuccess}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="w-full py-2.5 rounded-lg bg-primary hover:bg-green-600 text-white font-bold transition-all disabled:opacity-50"
                            >
                                {changingPassword ? 'Changing...' : 'Change Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-dark rounded-xl border border-red-500/50 w-full max-w-md">
                        <div className="p-6 border-b border-border-dark flex justify-between items-center">
                            <h3 className="text-xl font-bold text-red-500">Delete Account</h3>
                            <button onClick={() => setShowDeleteModal(false)} className="text-text-muted hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleDeleteAccount} className="p-6 space-y-4">
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-red-500 text-sm font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
                                <p className="text-text-muted text-sm">All your projects, queries, and data will be permanently deleted.</p>
                            </div>

                            {deleteError && (
                                <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm">
                                    {deleteError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Type DELETE to confirm</label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                    placeholder="DELETE"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Enter your password</label>
                                <input
                                    type="password"
                                    value={deleteConfirmPassword}
                                    onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                                    className="w-full bg-input-bg-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={deleting || deleteConfirmText !== 'DELETE'}
                                className="w-full py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-all disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete My Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
