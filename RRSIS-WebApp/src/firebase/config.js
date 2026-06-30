// Firebase Configuration
// ========================
// CADFormer Firebase Integration
// ========================

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBzNYlkjnz33cgyZmlhDTw_BYYSibkA1Ik",
    authDomain: "fyp-rrsis.firebaseapp.com",
    projectId: "fyp-rrsis",
    storageBucket: "fyp-rrsis.firebasestorage.app",
    messagingSenderId: "65715592753",
    appId: "1:65715592753:web:b89bba802de6ad31f73f10",
    measurementId: "G-W0YQ0KQTC0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

export default app;
