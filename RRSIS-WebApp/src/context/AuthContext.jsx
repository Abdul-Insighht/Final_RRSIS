import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import {
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    updateLastLogin,
    getUserStats,
    getUserProjects
} from '../firebase/firestore';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Listen for auth state changes
    // Listen for auth state changes
    useEffect(() => {
        let profileUnsubscribe = null;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Cleanup previous listener if any
            if (profileUnsubscribe) {
                profileUnsubscribe();
                profileUnsubscribe = null;
            }

            if (firebaseUser) {
                setUser(firebaseUser);

                try {
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const docSnap = await getDoc(userRef);

                    if (!docSnap.exists()) {
                        // Create profile if it doesn't exist (e.g., after Google sign-in)
                        await createUserProfile(firebaseUser.uid, {
                            email: firebaseUser.email,
                            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            photoURL: firebaseUser.photoURL
                        });
                    } else {
                        // Update last login
                        await updateLastLogin(firebaseUser.uid);
                    }

                    // Setup Real-time Listener for Credits/Profile updates
                    profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            if (data.status === 'suspended') {
                                await signOut(auth);
                                setUser(null);
                                setUserProfile(null);
                                alert('Your account has been suspended by the administrator.');
                            } else {
                                setUserProfile(data);
                            }
                        }
                    }, (error) => {
                        console.warn("Profile snapshot listener error (likely permissions, ignored during auth changes):", error);
                    });

                } catch (error) {
                    console.error("Error setting up user profile:", error);
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setIsLoading(false);
        });

        return () => {
            unsubscribe();
            if (profileUnsubscribe) profileUnsubscribe();
        };
    }, []);

    // Email/Password Sign Up
    const signup = async (email, password, name, userType = 'researcher') => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Update display name
            await updateProfile(userCredential.user, { displayName: name });

            // Create Firestore profile with role='user' and userType
            const profile = await createUserProfile(userCredential.user.uid, {
                email,
                name,
                userType  // Store userType (student/professional/researcher)
            });

            // Send verification email
            await sendEmailVerification(userCredential.user);

            setUserProfile(profile);
            return { success: true };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: getErrorMessage(error.code) };
        }
    };

    // Email/Password Login
    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Get and update profile
            const profile = await getUserProfile(userCredential.user.uid);

            // Check if user has correct role for User Login
            if (profile && profile.role !== 'user') {
                // Admin trying to log in via User Login page
                await signOut(auth); // Log them out immediately
                return {
                    success: false,
                    error: 'This account is not registered as a user. Please contact support.'
                };
            }

            if (profile && profile.status === 'suspended') {
                await signOut(auth);
                return {
                    success: false,
                    error: 'Your account is suspended.'
                };
            }

            if (profile) {
                await updateLastLogin(userCredential.user.uid);
                setUserProfile(profile);
            }

            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: getErrorMessage(error.code) };
        }
    };

    // Google Sign In
    const loginWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const firebaseUser = result.user;

            // Check if profile exists, if not create it
            let profile = await getUserProfile(firebaseUser.uid);

            if (!profile) {
                profile = await createUserProfile(firebaseUser.uid, {
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL
                });
            } else {
                // Check role for existing users
                if (profile.role !== 'user') {
                    await signOut(auth);
                    return {
                        success: false,
                        error: 'This account is not registered as a user. Please contact support.'
                    };
                }

                if (profile.status === 'suspended') {
                    await signOut(auth);
                    return {
                        success: false,
                        error: 'Your account is suspended.'
                    };
                }
                await updateLastLogin(firebaseUser.uid);
            }

            setUserProfile(profile);
            return { success: true };
        } catch (error) {
            console.error('Google login error:', error);
            return { success: false, error: getErrorMessage(error.code) };
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
            sessionStorage.clear();
            localStorage.removeItem('geosegai_token');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Reset Password
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: getErrorMessage(error.code) };
        }
    };

    // Get user dashboard data
    const getDashboardData = async () => {
        if (!user) return null;

        try {
            const [stats, projects] = await Promise.all([
                getUserStats(user.uid),
                getUserProjects(user.uid)
            ]);

            return {
                stats,
                recentProjects: projects.slice(0, 5),
                allProjects: projects
            };
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            return null;
        }
    };

    // Helper: Convert Firebase error codes to user-friendly messages
    const getErrorMessage = (code) => {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/invalid-credential': 'Invalid credentials. Please check your email and password.'
        };
        return errorMessages[code] || 'An error occurred. Please try again.';
    };

    // Update User Profile
    const updateUser = async (updates) => {
        try {
            if (!user) return { success: false, error: 'No user logged in' };

            // Update Firestore profile
            // Ensure email cannot be updated
            const sanitizedUpdates = { ...updates };
            delete sanitizedUpdates.email;

            await updateUserProfile(user.uid, sanitizedUpdates);

            // Refresh user profile
            const updatedProfile = await getUserProfile(user.uid);
            setUserProfile(updatedProfile);

            return { success: true };
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, error: error.message };
        }
    };

    // Resend Verification Email
    const resendVerificationEmail = async () => {
        if (user && !user.emailVerified) {
            try {
                await sendEmailVerification(user);
                return { success: true };
            } catch (error) {
                console.error('Error sending verification email:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'No user logged in or already verified' };
    };



    return (
        <AuthContext.Provider value={{
            user,
            userProfile,
            isLoading,
            signup,
            login,
            loginWithGoogle,
            logout,
            getDashboardData,
            updateUser,
            resendVerificationEmail,
            resetPassword // Added
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
