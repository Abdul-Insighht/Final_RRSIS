// Firestore Database Services
// ============================
// Helper functions for Firestore CRUD operations

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
    serverTimestamp,
    Timestamp,
    runTransaction,
    increment,
    collectionGroup,
    getCountFromServer
} from 'firebase/firestore';
import { db } from './config';

// ============== User Operations ==============

/**
 * Create a new user document in Firestore
 */
export const createUserProfile = async (uid, userData) => {
    const userRef = doc(db, 'users', uid);
    const userDoc = {
        uid,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        role: 'user', // Default role (user/admin) - for auth only
        userType: userData.userType || 'researcher', // User category (student/professional/researcher)
        status: 'active', // User status (active/suspended)
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        organization: userData.organization || '',
        avatar: userData.photoURL || '',
        credits: 20, // Initial free credits
        totalProjects: 0, // Cached project count
        totalQueries: 0, // Cached query count
        statsLastUpdated: serverTimestamp()
    };

    await setDoc(userRef, userDoc);

    // Log initial credit transaction
    const transactionRef = collection(db, 'transactions');
    await addDoc(transactionRef, {
        userId: uid,
        type: 'bonus',
        amount: 20,
        description: 'Welcome Bonus',
        timestamp: serverTimestamp()
    });

    return userDoc;
};

/**
 * Get user profile by UID
 */
export const getUserProfile = async (uid) => {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (uid, updates) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * Update last login timestamp
 */
export const updateLastLogin = async (uid) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        lastLogin: serverTimestamp()
    });
};

/**
 * Check if user is admin
 */
export const isUserAdmin = async (uid) => {
    const user = await getUserProfile(uid);
    return user?.role === 'admin';
};

// ============== User Statistics Counters ==============

/**
 * Increment user's project count
 */
export const incrementUserProjects = async (userId) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        totalProjects: increment(1),
        statsLastUpdated: serverTimestamp()
    });
};

/**
 * Decrement user's project count
 */
export const decrementUserProjects = async (userId) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        totalProjects: increment(-1),
        statsLastUpdated: serverTimestamp()
    });
};

/**
 * Increment user's query count
 */
export const incrementUserQueries = async (userId) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        totalQueries: increment(1),
        statsLastUpdated: serverTimestamp()
    });
};

/**
 * Decrement user's query count (for deletions)
 */
export const decrementUserQueries = async (userId, count = 1) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        totalQueries: increment(-count),
        statsLastUpdated: serverTimestamp()
    });
};

// ============== Transaction Operations ==============
export const getTransactionHistory = async (userId) => {
    try {
        console.log('Fetching transactions for userId:', userId);
        const transactionsRef = collection(db, 'transactions');

        // Simplified query without orderBy to avoid composite index requirement
        // We'll sort in JavaScript instead
        const q = query(
            transactionsRef,
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        console.log('Transactions found:', snapshot.docs.length);

        // Sort by timestamp in JavaScript (descending - newest first)
        const transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            // Handle Firestore Timestamp objects
            const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
            const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
            return timeB - timeA; // Descending order
        });

        console.log('Sorted transactions:', transactions);
        return transactions;
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

// ============== Admin: User Management ==============

/**
 * Get all users (admin only)
 */
export const getAllUsers = async () => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

/**
 * Update user status (admin only)
 */
export const updateUserStatus = async (uid, status) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status });
};

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (uid, role) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role });
};

/**
 * Delete user (admin only)
 */
export const deleteUser = async (uid) => {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
};

// ============== Project Operations ==============

/**
 * Get the next project number for auto-naming (e.g., "Untitled Project 3")
 */
export const getNextProjectNumber = async (userId) => {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.size + 1;
};

/**
 * Create a new project with project-based workflow
 * Model and image are locked after first set - cannot be changed later
 */
export const createProject = async (userId, projectData) => {
    try {
        // Fetch system config for dynamic project cost
        const systemConfig = await getSystemConfig();
        const PROJECT_COST = systemConfig?.projectCost || 5; // Default to 5 if not set

        return await runTransaction(db, async (transaction) => {
            // 1. Check & Deduct Credits
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error('User does not exist');
            }

            const currentCredits = userSnap.data().credits || 0;
            if (currentCredits < PROJECT_COST) {
                throw new Error(`Insufficient credits. Required: ${PROJECT_COST}, Available: ${currentCredits}`);
            }

            // 2. Prepare Project Data
            const projectsRef = collection(db, 'projects');
            const projectDocRef = doc(projectsRef); // Generate new ID

            const project = {
                projectId: projectDocRef.id,
                ownerId: userId,
                userId, // Keep for backward compatibility
                name: projectData.name,

                // Original image - locked after first upload
                originalImageUrl: projectData.imageUrl || '',
                originalImageName: projectData.imageName || '',

                // Model selection - locked at project creation
                modelId: projectData.modelId || '',
                modelName: projectData.modelName || '',

                // Stats
                queryCount: 0,
                lastQueryAt: null,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // 3. Execute Updates (Deduct + Create + Log + Increment Counter)
            transaction.update(userRef, {
                credits: currentCredits - PROJECT_COST,
                totalProjects: increment(1),
                statsLastUpdated: serverTimestamp()
            });
            transaction.set(projectDocRef, project);

            const transRef = doc(collection(db, 'transactions'));
            transaction.set(transRef, {
                userId,
                type: 'usage',
                amount: -PROJECT_COST,
                description: `Created Project: ${projectData.name}`,
                timestamp: serverTimestamp()
            });

            // Return project data so the caller receives it (Note: transaction returns promise result)
            return { id: projectDocRef.id, ...project };
        });
    } catch (error) {
        console.error('Create project error:', error);
        throw error;
    }
};

/**
 * Get user's projects
 */
export const getUserProjects = async (userId) => {
    const projectsRef = collection(db, 'projects');
    // NOTE: We only filter by userId here to avoid needing a composite index for (userId + updatedAt).
    // Sorting is done client-side.
    const q = query(
        projectsRef,
        where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Sort by updatedAt descending (newest first)
    return projects.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
    });
};

/**
 * Get project by ID
 */
export const getProject = async (projectId) => {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
        return { id: projectSnap.id, ...projectSnap.data() };
    }
    return null;
};

/**
 * Update project metadata
 * Note: modelId, modelName, and originalImageUrl cannot be changed after initial set
 */
export const updateProject = async (projectId, updates) => {
    const projectRef = doc(db, 'projects', projectId);

    // Sanitize updates - prevent changing locked fields
    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates.modelId;
    delete sanitizedUpdates.modelName;
    delete sanitizedUpdates.originalImageUrl;
    delete sanitizedUpdates.originalImageName;
    delete sanitizedUpdates.ownerId;
    delete sanitizedUpdates.userId;
    delete sanitizedUpdates.projectId;

    await updateDoc(projectRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp()
    });
    await updateDoc(projectRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp()
    });
};

// ============== Credit Operations ==============

/**
 * Get user credits
 */
export const getUserCredits = async (userId) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data().credits || 0;
    }
    return 0;
};

/**
 * Deduct credits from user (Transactional)
 * Returns { success: true, newBalance } or { success: false, error }
 */
export const deductUserCredits = async (userId, amount, description) => {
    try {
        const newBalance = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error('User does not exist');
            }

            const currentCredits = userSnap.data().credits || 0;
            if (currentCredits < amount) {
                throw new Error('Insufficient credits');
            }

            const newCredits = currentCredits - amount;
            transaction.update(userRef, { credits: newCredits });

            // Log transaction
            const transactionRef = doc(collection(db, 'transactions'));
            transaction.set(transactionRef, {
                userId,
                type: 'usage',
                amount: -amount,
                description,
                timestamp: serverTimestamp()
            });

            return newCredits;
        });

        return { success: true, newBalance };
    } catch (error) {
        console.error('Credit deduction failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Add credits to user (Transactional)
 */
export const addUserCredits = async (userId, amount, description, type = 'purchase') => {
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            transaction.update(userRef, { credits: increment(amount) });

            const transactionRef = doc(collection(db, 'transactions'));
            transaction.set(transactionRef, {
                userId,
                type,
                amount,
                description,
                timestamp: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error) {
        console.error('Add credits failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Set project's original image (can only be done once)
 * This is separate from updateProject to explicitly control image locking
 */
export const setProjectImage = async (projectId, imageUrl, imageName) => {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
        throw new Error('Project not found');
    }

    const project = projectSnap.data();

    // Only allow setting image if not already set
    if (project.originalImageUrl && project.originalImageUrl.length > 0) {
        console.warn('Image already set for this project. Cannot change.');
        return false;
    }

    await updateDoc(projectRef, {
        originalImageUrl: imageUrl,
        originalImageName: imageName,
        updatedAt: serverTimestamp()
    });

    return true;
};

/**
 * Delete project and all its queries
 */
export const deleteProject = async (projectId) => {
    // First, delete all queries in the subcollection
    const queriesRef = collection(db, 'projects', projectId, 'queries');
    const queriesSnapshot = await getDocs(queriesRef);

    const deletePromises = queriesSnapshot.docs.map(queryDoc =>
        deleteDoc(queryDoc.ref)
    );
    await Promise.all(deletePromises);

    // Then delete the project itself
    const projectRef = doc(db, 'projects', projectId);
    await deleteDoc(projectRef);
};

// ============== Query Operations (Subcollection) ==============

/**
 * Add a query to a project
 */
export const addQueryToProject = async (projectId, queryData) => {
    console.log('🔵 addQueryToProject CALLED:', { projectId, queryText: queryData.queryText });
    const queriesRef = collection(db, 'projects', projectId, 'queries');

    const queryRecord = {
        queryText: queryData.queryText,
        modelUsed: queryData.modelUsed || 'CADFormer',
        maskUrl: queryData.maskUrl || '',
        overlayUrl: queryData.overlayUrl || '',
        originalUrl: queryData.originalUrl || '',
        status: queryData.status || 'completed',
        processingTime: queryData.processingTime || 0,
        coverage: queryData.coverage || 0,
        createdAt: serverTimestamp()
    };

    console.log('🔵 About to call addDoc with queryRecord:', queryRecord);
    const queryDoc = await addDoc(queriesRef, queryRecord);
    console.log('✅ Query document created with ID:', queryDoc.id);

    // Update the record with its own ID (optional but consistent)
    await updateDoc(queryDoc, { queryId: queryDoc.id });
    console.log('✅ Query document updated with queryId field');

    // Update project metadata
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
        const currentCount = projectSnap.data().queryCount || 0;
        const ownerId = projectSnap.data().ownerId || projectSnap.data().userId;

        console.log('🔵 Updating project queryCount from', currentCount, 'to', currentCount + 1);
        await updateDoc(projectRef, {
            queryCount: currentCount + 1,
            lastQueryAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Increment user's totalQueries counter
        if (ownerId) {
            await incrementUserQueries(ownerId);
        }
    }

    console.log('✅ addQueryToProject COMPLETED successfully for query:', queryDoc.id);
    return { id: queryDoc.id, ...queryRecord };
};

/**
 * Get all queries for a project
 */
export const getProjectQueries = async (projectId) => {
    console.log('🔍 getProjectQueries CALLED for projectId:', projectId);
    const queriesRef = collection(db, 'projects', projectId, 'queries');
    const q = query(queriesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const queries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log('🔍 getProjectQueries FOUND', queries.length, 'queries:', queries.map(q => ({ id: q.id, text: q.queryText })));
    return queries;
};

/**
 * Get a single query
 */
export const getQuery = async (projectId, queryId) => {
    const queryRef = doc(db, 'projects', projectId, 'queries', queryId);
    const querySnap = await getDoc(queryRef);

    if (querySnap.exists()) {
        return { id: querySnap.id, ...querySnap.data() };
    }
    return null;
};

/**
 * Update a query
 */
export const updateQuery = async (projectId, queryId, updates) => {
    const queryRef = doc(db, 'projects', projectId, 'queries', queryId);
    await updateDoc(queryRef, updates);
};

/**
 * Delete a query
 */
export const deleteQuery = async (projectId, queryId) => {
    const queryRef = doc(db, 'projects', projectId, 'queries', queryId);
    await deleteDoc(queryRef);

    // Update project query count
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
        const currentCount = projectSnap.data().queryCount || 0;
        await updateDoc(projectRef, {
            queryCount: Math.max(0, currentCount - 1),
            updatedAt: serverTimestamp()
        });
    }
};


// ============== Admin: All Projects ==============

/**
 * Get all projects (admin only)
 */
export const getAllProjects = async () => {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

// ============== Models Management ==============

/**
 * Get all models
 */
export const getAllModels = async () => {
    const modelsRef = collection(db, 'models');
    const snapshot = await getDocs(modelsRef);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

/**
 * Get enabled models only (and must be integrated in the backend code)
 */
export const getEnabledModels = async () => {
    const modelsRef = collection(db, 'models');
    const q = query(modelsRef, where('status', '==', 'enabled'));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        .filter(model => model.isIntegrated === true);
};

/**
 * Create model (admin only)
 */
export const createModel = async (modelData) => {
    const modelsRef = collection(db, 'models');
    const modelDoc = doc(modelsRef);

    const model = {
        id: modelDoc.id,
        name: modelData.name,
        description: modelData.description,
        version: modelData.version,
        status: modelData.status || 'enabled',
        createdAt: serverTimestamp()
    };

    await setDoc(modelDoc, model);
    return model;
};

/**
 * Update model (admin only)
 */
export const updateModel = async (modelId, updates) => {
    const modelRef = doc(db, 'models', modelId);
    await updateDoc(modelRef, updates);
};

/**
 * Delete model (admin only)
 */
export const deleteModel = async (modelId) => {
    const modelRef = doc(db, 'models', modelId);
    await deleteDoc(modelRef);
};

// ============== API Keys Management ==============

/**
 * Get all API keys (admin only)
 */
export const getAllApiKeys = async () => {
    const keysRef = collection(db, 'apiKeys');
    const snapshot = await getDocs(keysRef);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

/**
 * Create API key (admin only)
 */
export const createApiKey = async (keyData, createdBy) => {
    const keysRef = collection(db, 'apiKeys');
    const keyDoc = doc(keysRef);

    const apiKey = {
        id: keyDoc.id,
        name: keyData.name,
        key: crypto.randomUUID(),
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy
    };

    await setDoc(keyDoc, apiKey);
    return apiKey;
};

/**
 * Revoke API key (admin only)
 */
export const revokeApiKey = async (keyId) => {
    const keyRef = doc(db, 'apiKeys', keyId);
    await updateDoc(keyRef, { status: 'revoked' });
};

/**
 * Delete API key (admin only)
 */
export const deleteApiKey = async (keyId) => {
    const keyRef = doc(db, 'apiKeys', keyId);
    await deleteDoc(keyRef);
};

// ============== System Config ==============

/**
 * Get system config
 */
export const getSystemConfig = async () => {
    const configRef = doc(db, 'config', 'system');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
        return configSnap.data();
    }

    // Return defaults if not set
    return {
        appName: 'GeoSegAI',
        maxUploadSizeMb: 50,
        segmentationTimeout: 300,
        enableEmailNotifications: false
    };
};

/**
 * Update system config (admin only)
 */
export const updateSystemConfig = async (updates) => {
    const configRef = doc(db, 'config', 'system');
    await setDoc(configRef, updates, { merge: true });
};

// ============== Stats ==============

/**
 * Get system stats (admin only)
 */
export const getSystemStats = async () => {
    const [users, projects, models] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'models'))
    ]);

    const usersData = users.docs.map(d => d.data());
    const modelsData = models.docs.map(d => d.data());

    // Filter out Admin users
    const nonAdminUsers = usersData.filter(u => u.role !== 'admin');

    // Get Total Queries count
    // Strategy: Try Collection Group (Fast/Scalable) -> Fallback to Iterative (Reliable/No Index)
    let totalQueries = 0;
    try {
        const queriesSnapshot = await getCountFromServer(query(collectionGroup(db, 'queries')));
        totalQueries = queriesSnapshot.data().count;
    } catch (e) {
        console.warn('Collection Group query failed (likely missing index), falling back to iterative counting:', e);
        try {
            // Fallback: Iterate projects and count queries in each
            const updatedProjects = await getDocs(collection(db, 'projects')); // Re-fetch to be sure or use existing 'projects'
            const counts = await Promise.all(
                updatedProjects.docs.map(p =>
                    getCountFromServer(collection(db, 'projects', p.id, 'queries'))
                        .then(snap => snap.data().count)
                        .catch(() => 0)
                )
            );
            totalQueries = counts.reduce((a, b) => a + b, 0);
        } catch (err) {
            console.error('Fallback query counting failed:', err);
        }
    }

    return {
        totalUsers: nonAdminUsers.length,
        totalCredits: nonAdminUsers.reduce((sum, user) => sum + (user.credits || 0), 0),
        activeUsers: nonAdminUsers.filter(u => u.status !== 'suspended').length,
        suspendedUsers: nonAdminUsers.filter(u => u.status === 'suspended').length,
        totalProjects: projects.size,
        totalSegmentations: totalQueries,
        totalQueries: totalQueries,
        totalModels: models.size,
        enabledModels: modelsData.filter(m => m.status === 'enabled').length
    };
};

/**
 * Get user stats
 */
export const getUserStats = async (userId) => {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const projects = snapshot.docs.map(d => d.data());

    return {
        totalProjects: projects.length,
        completedSegmentations: projects.filter(p => p.status === 'completed').length,
        processingCount: projects.filter(p => p.status === 'processing').length
    };
};
