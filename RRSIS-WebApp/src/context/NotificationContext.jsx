import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Notification visibility preference (persisted to localStorage)
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const saved = localStorage.getItem('notificationsEnabled');
        return saved !== null ? JSON.parse(saved) : true; // Default: enabled
    });

    // Toggle notification visibility
    const toggleNotifications = (enabled) => {
        setNotificationsEnabled(enabled);
        localStorage.setItem('notificationsEnabled', JSON.stringify(enabled));
    };

    // Real-time listener for notifications
    useEffect(() => {
        if (!user?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.isRead).length);
                setLoading(false);
            }, (error) => {
                console.error('Error fetching notifications:', error);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up notifications listener:', error);
            setLoading(false);
        }
    }, [user]);

    const markAsRead = async (notificationId) => {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, { isRead: true });

            // Update local state immediately for better UX
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifs = notifications.filter(n => !n.isRead);

            await Promise.all(
                unreadNotifs.map(notif => {
                    const notifRef = doc(db, 'notifications', notif.id);
                    return updateDoc(notifRef, { isRead: true });
                })
            );

            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        notificationsEnabled,
        toggleNotifications,
        markAsRead,
        markAllAsRead
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
