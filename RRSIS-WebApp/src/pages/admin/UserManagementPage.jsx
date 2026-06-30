import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    getAllUsers,
    updateUserCredits,
    toggleUserStatus,
    adminUpdateUser
} from '../../firebase/firestore_admin';
import CreditAdjustmentModal from '../../components/admin/CreditAdjustmentModal';

const UserManagementPage = () => {
    const { admin, isAdmin } = useAdminAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [filteredCount, setFilteredCount] = useState(0);
    const [editingUser, setEditingUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [activeCreditUserId, setActiveCreditUserId] = useState(null);
    const creditUser = users.find(u => u.id === activeCreditUserId);
    const [showCreditModal, setShowCreditModal] = useState(false);

    const fetchUsers = async () => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const result = await getAllUsers({
                page: currentPage,
                limit: 20,
                search: searchTerm,
                statusFilter,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Backend already filters out admin users
            setUsers(result.users);
            setTotalPages(result.totalPages);
            setTotalUsers(result.total);  // Total users (before search/filter)
            setFilteredCount(result.filtered);  // Filtered count (after search/filter)
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [isAdmin, currentPage, searchTerm, statusFilter]);

    const handleUpdateUser = async (userId, updates) => {
        try {
            await adminUpdateUser(userId, updates, admin.uid);
            fetchUsers();
            setShowEditModal(false);
            setEditingUser(null);
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        try {
            await toggleUserStatus(userId, newStatus, admin.uid);
            fetchUsers();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const handleCreditAdjustment = async (userId, amount, reason) => {
        try {
            await updateUserCredits(userId, amount, reason, admin.uid);
            fetchUsers();
            setShowCreditModal(false);
            setActiveCreditUserId(null);
        } catch (error) {
            console.error('Error adjusting credits:', error);
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'suspended') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    Suspended
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                Active
            </span>
        );
    };

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
                        <p className="text-text-muted">Manage user accounts and permissions</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-surface-dark p-4 rounded-xl border border-border-dark flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border-border-dark bg-input-bg-dark text-white focus:border-primary focus:ring-primary text-sm h-10 px-4"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>

                {/* Users Table */}
                <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                    {/* Stats Header */}
                    <div className="px-6 py-3 bg-white/5 border-b border-border-dark flex items-center justify-between">
                        <p className="text-sm text-text-muted">
                            Showing <span className="text-white font-semibold">{filteredCount}</span> of <span className="text-white font-semibold">{totalUsers}</span> users
                        </p>
                        <p className="text-sm text-text-muted">
                            Page {currentPage} of {totalPages}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                            No users found
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Credits</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark text-slate-300">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                                            <td className="px-6 py-4">{user.email}</td>
                                            <td className="px-6 py-4">{user.role || 'User'}</td>
                                            <td className="px-6 py-4 font-mono text-primary font-bold">{user.credits || 0}</td>
                                            <td className="px-6 py-4">{getStatusBadge(user.status || 'active')}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingUser(user);
                                                            setShowEditModal(true);
                                                        }}
                                                        className="p-2 hover:bg-white/10 rounded text-sky-blue transition-colors"
                                                        title="Edit user"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActiveCreditUserId(user.id);
                                                            setShowCreditModal(true);
                                                        }}
                                                        className="p-2 hover:bg-white/10 rounded text-yellow-400 transition-colors"
                                                        title="Manage Credits"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">payments</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.status || 'active')}
                                                        className={`p-2 hover:bg-white/10 rounded transition-colors ${user.status === 'suspended' ? 'text-green-500' : 'text-yellow-500'}`}
                                                        title={user.status === 'suspended' ? 'Activate' : 'Suspend'}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">
                                                            {user.status === 'suspended' ? 'check_circle' : 'block'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(user)}
                                                        className="p-2 hover:bg-white/10 rounded text-red-500 transition-colors"
                                                        title="Delete user"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Edit Modal */}
                {showEditModal && editingUser && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Edit User</h3>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    handleUpdateUser(editingUser.id, {
                                        name: formData.get('name'),
                                        role: formData.get('role'),
                                        organization: formData.get('organization'),
                                    });
                                }}
                                className="flex flex-col gap-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5">Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={editingUser.name}
                                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5">Role</label>
                                    <input
                                        type="text"
                                        name="role"
                                        defaultValue={editingUser.role}
                                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5">Organization</label>
                                    <input
                                        type="text"
                                        name="organization"
                                        defaultValue={editingUser.organization}
                                        className="w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-10 px-4"
                                    />
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingUser(null);
                                        }}
                                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-green-600 text-white font-medium transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Delete User</h3>
                            <p className="text-text-muted mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">{showDeleteConfirm.name}</span>? This action cannot be undone and will delete all their data.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteUser(showDeleteConfirm.id)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                >
                                    Delete User
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Credit Adjustment Modal */}
                {showCreditModal && creditUser && (
                    <CreditAdjustmentModal
                        isOpen={showCreditModal}
                        user={creditUser}
                        onClose={() => {
                            setShowCreditModal(false);
                            setActiveCreditUserId(null);
                        }}
                        onAdjust={handleCreditAdjustment}
                    />
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                            Previous
                        </button>
                        <div className="flex items-center gap-2">
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                // Show first, last, current, and adjacent pages
                                if (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 rounded-lg transition-colors ${page === currentPage
                                                ? 'bg-primary text-white font-semibold'
                                                : 'bg-white/5 hover:bg-white/10 text-white'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                    return <span key={page} className="text-text-muted">...</span>;
                                }
                                return null;
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            Next
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagementPage;
