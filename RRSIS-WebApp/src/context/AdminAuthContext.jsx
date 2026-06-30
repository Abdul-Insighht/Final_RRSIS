import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
    getUserProfile,
    isUserAdmin,
    getSystemStats,
    getAllUsers,
    getAllModels,
    createModel, // Added import
    getAllApiKeys,
    getSystemConfig
} from '../firebase/firestore';

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within an AdminAuthProvider');
    }
    return context;
};

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [token, setToken] = useState(null); // Added token state
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Check if user has admin role
                const adminStatus = await isUserAdmin(firebaseUser.uid);

                if (adminStatus) {
                    const profile = await getUserProfile(firebaseUser.uid);
                    const idToken = await firebaseUser.getIdToken(); // Get Token
                    setAdmin(profile);
                    setToken(idToken);
                    setToken(idToken);
                    setIsAdmin(true);

                    // Auto-initialize default model if missing
                    getAllModels().then(async (models) => {
                        if (models.length === 0) {
                            console.log("Initializing default CADFormer model...");
                            await createModel({
                                name: 'CADFormer',
                                description: 'Context-Aware Deformable Transformer for semantic segmentation in remote sensing imagery with multi-scale feature extraction',
                                version: '1.0',
                                status: 'enabled'
                            });
                        }
                    }).catch(console.error);
                } else {
                    setAdmin(null);
                    setToken(null);
                    setIsAdmin(false);
                }
            } else {
                setAdmin(null);
                setToken(null);
                setIsAdmin(false);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Admin Login with Firebase Auth
    const adminLogin = async (email, password) => {
        try {
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Get user profile and check role
            const profile = await getUserProfile(userCredential.user.uid);

            if (!profile || profile.role !== 'admin') {
                // Regular user trying to access Admin Panel
                await signOut(auth);
                return {
                    success: false,
                    error: 'Access denied. This account does not have administrative privileges.'
                };
            }

            // Valid admin user
            setAdmin(profile);
            setIsAdmin(true);
            return { success: true };
        } catch (error) {
            console.error('Admin login error:', error);

            // User-friendly error messages
            let errorMessage = 'Login failed. Please check your credentials.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later.';
            }

            return { success: false, error: errorMessage };
        }
    };

    const adminLogout = async () => {
        try {
            await signOut(auth);
            setAdmin(null);
            setIsAdmin(false);
        } catch (error) {
            console.error('Admin logout error:', error);
        }
    };

    // Admin API helper - wraps Firestore calls with admin verification
    const fetchAdminApi = async (endpoint, options = {}) => {
        if (!isAdmin) {
            return { success: false, error: 'Not authorized' };
        }

        try {
            // Route to appropriate Firestore function based on endpoint
            let data;

            switch (endpoint) {
                case '/system/stats':
                    data = { stats: await getSystemStats() };
                    break;
                case '/system/config':
                    data = { config: await getSystemConfig() };
                    break;
                case '/users':
                    data = { users: await getAllUsers() };
                    break;
                case '/models':
                    data = { models: await getAllModels() };
                    break;
                case '/api-keys':
                    data = { api_keys: await getAllApiKeys() };
                    break;
                default:
                    return { success: false, error: 'Unknown endpoint' };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Admin API error:', error);
            return { success: false, error: error.message };
        }
    };

    return (
        <AdminAuthContext.Provider value={{
            admin,
            isLoading,
            token, // Expose token
            isAdmin,
            adminLogin,
            adminLogout,
            fetchAdminApi
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export default AdminAuthContext;
