// Admin-specific Firestore functions
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    runTransaction
} from 'firebase/firestore';
import { db } from './config';

// ============== ADMIN: System Statistics ==============

/**
 * Get real-time system statistics for admin dashboard
 */
export const getSystemStats = async () => {
    try {
        // Fetch all collections in parallel
        const [usersSnap, projectsSnap, modelsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'projects')),
            getDocs(collection(db, 'models'))
        ]);

        // Calculate total credits and queries
        let totalCredits = 0;
        let activeUsers = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        usersSnap.forEach(doc => {
            const user = doc.data();
            totalCredits += user.credits || 0;

            // Check if user was active in last 30 days
            if (user.lastLogin && user.lastLogin.toDate() > thirtyDaysAgo) {
                activeUsers++;
            }
        });

        // Count total queries across all projects
        let totalQueries = 0;
        for (const projectDoc of projectsSnap.docs) {
            const queriesSnap = await getDocs(collection(db, 'projects', projectDoc.id, 'queries'));
            totalQueries += queriesSnap.size;
        }

        // Count enabled and total models that are integrated
        const totalModels = modelsSnap.docs.filter(doc => doc.data().isIntegrated === true).length;
        const enabledModels = modelsSnap.docs.filter(doc => doc.data().status === 'enabled' && doc.data().isIntegrated === true).length;

        // Calculate storage used (placeholder - would need backend integration for actual file sizes)
        // For now, estimate based on project count (assuming ~10MB per project on average)
        const estimatedStorageMB = Math.round(projectsSnap.size * 10);

        return {
            totalUsers: usersSnap.size,
            activeUsers,
            totalProjects: projectsSnap.size,
            totalQueries,
            totalCredits,
            totalModels: totalModels,
            enabledModels,
            storageUsed: estimatedStorageMB
        };
    } catch (error) {
        console.error('Error fetching system stats:', error);
        throw error;
    }
};

// ============== ADMIN: User Management ==============

/**
 * Get all users with pagination, search, and filtering
 */
export const getAllUsers = async (options = {}) => {
    const {
        page = 1,
        limit = 20,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        statusFilter = 'all',
        minCredits = null,
        maxCredits = null
    } = options;

    try {
        let q = collection(db, 'users');
        const constraints = [];

        // Apply credit filters (if needed)
        if (minCredits !== null) {
            constraints.push(where('credits', '>=', minCredits));
        }
        if (maxCredits !== null) {
            constraints.push(where('credits', '<=', maxCredits));
        }

        // Apply sorting
        constraints.push(orderBy(sortBy, sortOrder));

        // Build query
        if (constraints.length > 0) {
            q = query(q, ...constraints);
        }

        const snapshot = await getDocs(q);
        let allUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Filter out admin users (client-side to avoid composite index)
        allUsers = allUsers.filter(user => user.role !== 'admin');

        // Store total count BEFORE filtering
        const totalUsersCount = allUsers.length;

        // Apply status filter (client-side to avoid composite index)
        if (statusFilter !== 'all') {
            allUsers = allUsers.filter(user => user.status === statusFilter);
        }

        // Apply search filter (client-side)
        if (search) {
            const searchLower = search.toLowerCase();
            allUsers = allUsers.filter(user =>
                user.name?.toLowerCase().includes(searchLower) ||
                user.email?.toLowerCase().includes(searchLower)
            );
        }

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = allUsers.slice(startIndex, endIndex);

        return {
            users: paginatedUsers,
            total: totalUsersCount,  // Total users (excluding admins, before search/filter)
            filtered: allUsers.length,  // Filtered count (after search/status filter)
            page,
            totalPages: Math.ceil(allUsers.length / limit)
        };
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

/**
 * Update user credits with admin logging
 */
export const updateUserCredits = async (userId, amount, reason, adminId) => {
    try {
        const userRef = doc(db, 'users', userId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }

            const currentCredits = userDoc.data().credits || 0;
            const newCredits = currentCredits + amount;

            // Update user credits
            transaction.update(userRef, {
                credits: newCredits,
                updatedAt: serverTimestamp()
            });

            // Log the transaction
            const transactionRef = doc(collection(db, 'creditTransactions'));
            transaction.set(transactionRef, {
                userId,
                amount,
                reason,
                type: 'admin_adjustment',
                adminId,
                previousBalance: currentCredits,
                newBalance: newCredits,
                timestamp: serverTimestamp()
            });

            // Log admin action
            const adminLogRef = doc(collection(db, 'adminLogs'));
            transaction.set(adminLogRef, {
                action: 'credit_adjustment',
                adminId,
                targetUserId: userId,
                changes: { amount, reason },
                timestamp: serverTimestamp()
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating user credits:', error);
        throw error;
    }
};

/**
 * Toggle user account status (active/suspended)
 */
export const toggleUserStatus = async (userId, newStatus, adminId) => {
    try {
        const userRef = doc(db, 'users', userId);

        await updateDoc(userRef, {
            status: newStatus,
            statusChangedBy: adminId,
            statusChangedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'user_status_change',
            adminId,
            targetUserId: userId,
            changes: { newStatus },
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error toggling user status:', error);
        throw error;
    }
};

/**
 * Update user profile (admin override)
 */
export const adminUpdateUser = async (userId, updates, adminId) => {
    try {
        const userRef = doc(db, 'users', userId);

        await updateDoc(userRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'user_profile_update',
            adminId,
            targetUserId: userId,
            changes: updates,
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
};

// ============== ADMIN: Model Management ==============

/**
 * Get all registered models
 */
export const getAllModels = async () => {
    try {
        const modelsSnap = await getDocs(collection(db, 'models'));
        return modelsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
};

/**
 * Create a new model registration
 */
export const createModel = async (modelData, adminId) => {
    try {
        const modelRef = doc(collection(db, 'models'));
        const model = {
            ...modelData,
            status: modelData.status || 'disabled',
            performance: {
                avgInferenceTime: 0,
                successRate: 0,
                totalQueries: 0,
                lastHealthCheck: null
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: adminId
        };

        await setDoc(modelRef, model);

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'model_created',
            adminId,
            modelId: modelRef.id,
            changes: modelData,
            timestamp: serverTimestamp()
        });

        return { success: true, id: modelRef.id };
    } catch (error) {
        console.error('Error creating model:', error);
        throw error;
    }
};

/**
 * Update model configuration
 */
export const updateModel = async (modelId, updates, adminId) => {
    try {
        const modelRef = doc(db, 'models', modelId);

        await updateDoc(modelRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'model_updated',
            adminId,
            modelId,
            changes: updates,
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating model:', error);
        throw error;
    }
};

/**
 * Delete a model
 */
export const deleteModel = async (modelId, adminId) => {
    try {
        const modelRef = doc(db, 'models', modelId);
        await deleteDoc(modelRef);

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'model_deleted',
            adminId,
            modelId,
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting model:', error);
        throw error;
    }
};

// ============== ADMIN: Activity Logs ==============

/**
 * Log important system activity
 */
export const logActivity = async (activityData) => {
    try {
        await addDoc(collection(db, 'activityLogs'), {
            ...activityData,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - logging failures shouldn't break the app
    }
};

/**
 * Get activity logs with filtering
 */
export const getActivityLogs = async (options = {}) => {
    const {
        limit = 50,
        type = 'all',
        startDate = null,
        endDate = null
    } = options;

    try {
        let q = collection(db, 'activityLogs');
        const constraints = [];

        // Filter by type
        if (type !== 'all') {
            constraints.push(where('type', '==', type));
        }

        // Filter by date range
        if (startDate) {
            constraints.push(where('timestamp', '>=', Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            constraints.push(where('timestamp', '<=', Timestamp.fromDate(endDate)));
        }

        // Sort and limit
        constraints.push(orderBy('timestamp', 'desc'));
        constraints.push(limit(limit));

        if (constraints.length > 0) {
            q = query(q, ...constraints);
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
};

/**
 * Clean up old activity logs (30 days retention)
 */
export const cleanupOldLogs = async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const q = query(
            collection(db, 'activityLogs'),
            where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo))
        );

        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        console.log(`Cleaned up ${snapshot.size} old activity logs`);
        return { deleted: snapshot.size };
    } catch (error) {
        console.error('Error cleaning up logs:', error);
        throw error;
    }
};

// ============== ADMIN: System Configuration ==============

/**
 * Get system configuration
 */
export const getSystemConfig = async () => {
    try {
        const configRef = doc(db, 'system', 'config');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            return configSnap.data();
        }

        // Return default config if not exists
        return {
            defaultCredits: 20,
            projectCost: 1,
            queryCost: 1,
            maxProjectsPerUser: 100,
            maxQueriesPerProject: 1000,
            maxUploadSizeMB: 10,
            maintenanceMode: false,
            createdAt: serverTimestamp()
        };
    } catch (error) {
        console.error('Error fetching system config:', error);
        throw error;
    }
};

/**
 * Update system configuration
 */
export const updateSystemConfig = async (updates, adminId) => {
    try {
        const configRef = doc(db, 'system', 'config');

        await setDoc(configRef, {
            ...updates,
            lastUpdatedBy: adminId,
            lastUpdatedAt: serverTimestamp()
        }, { merge: true });

        // Log admin action
        await addDoc(collection(db, 'adminLogs'), {
            action: 'config_update',
            adminId,
            changes: updates,
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating system config:', error);
        throw error;
    }
};

// ============== ADMIN: Analytics & Reports ==============

/**
 * Get user growth data for charts
 */
export const getUserGrowthData = async (days = 30) => {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(doc => ({
            createdAt: doc.data().createdAt?.toDate()
        })).filter(u => u.createdAt);

        // Group by date
        const growthMap = {};
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        users.forEach(user => {
            if (user.createdAt >= startDate) {
                const dateKey = user.createdAt.toISOString().split('T')[0];
                growthMap[dateKey] = (growthMap[dateKey] || 0) + 1;
            }
        });

        // Convert to array format for charts
        return Object.entries(growthMap).map(([date, count]) => ({
            date,
            count
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
        console.error('Error fetching user growth data:', error);
        throw error;
    }
};

/**
 * Get query volume data for charts
 */
export const getQueryVolumeData = async (days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const projectsSnap = await getDocs(collection(db, 'projects'));
        const volumeMap = {};

        for (const projectDoc of projectsSnap.docs) {
            const queriesSnap = await getDocs(collection(db, 'projects', projectDoc.id, 'queries'));

            queriesSnap.forEach(queryDoc => {
                const createdAt = queryDoc.data().createdAt?.toDate();
                if (createdAt && createdAt >= startDate) {
                    const dateKey = createdAt.toISOString().split('T')[0];
                    volumeMap[dateKey] = (volumeMap[dateKey] || 0) + 1;
                }
            });
        }

        return Object.entries(volumeMap).map(([date, count]) => ({
            date,
            count
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
        console.error('Error fetching query volume data:', error);
        throw error;
    }
};
