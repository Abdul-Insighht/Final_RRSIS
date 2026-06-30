import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const Header = ({ onMenuClick, pageTitle = 'Dashboard', hideCredits = false }) => {
    const { user, userProfile } = useAuth();
    const { notifications, unreadCount, notificationsEnabled, markAsRead, markAllAsRead } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const bellButtonRef = useRef(null);

    // Generate initials from full name (first letter of each word)
    const getInitials = (name) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .filter(word => word.length > 0)
            .map(word => word[0].toUpperCase())
            .join('');
    };

    // Merge data from Firebase user and Firestore profile
    const userName = userProfile?.name || userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
    const userType = userProfile?.userType || ''; // student/professional/researcher
    const userAvatar = userProfile?.avatar || user?.photoURL;
    const userInitials = getInitials(userName);

    // Capitalize userType for display
    const displayUserType = userType ? userType.charAt(0).toUpperCase() + userType.slice(1) : '';

    return (
        <header className="flex h-16 items-center justify-between px-4 lg:px-8 border-b border-border-dark bg-background-dark shrink-0 z-20">
            <div className="flex items-center gap-4">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h2 className="text-xl font-semibold text-white hidden sm:block">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">


                {/* Credit Balance */}
                {!hideCredits && (
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20 text-xs font-semibold text-primary mr-2"
                    >
                        <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                        <span>{userProfile?.credits || 0} Credits</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('OPEN_PAYMENT_MODAL'));
                            }}
                            className="bg-primary text-white rounded-full p-0.5 flex items-center justify-center hover:bg-green-400 hover:scale-110 active:scale-95 cursor-pointer transition-all shadow-sm hover:shadow-md"
                        >
                            <span className="material-symbols-outlined text-[10px]">add</span>
                        </button>
                    </div>
                )}

                {/* Notifications - Only show if enabled in settings */}
                {notificationsEnabled && (
                    <div className="relative">
                        <button
                            ref={bellButtonRef}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowNotifications(!showNotifications);
                            }}
                            className="relative p-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-white/5"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background-dark"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <NotificationDropdown
                                notifications={notifications}
                                onMarkAsRead={markAsRead}
                                onMarkAllAsRead={markAllAsRead}
                                onClose={() => setShowNotifications(false)}
                                bellButtonRef={bellButtonRef}
                            />
                        )}
                    </div>
                )}

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-2 lg:pl-4 border-l border-border-dark">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white">{userName}</p>
                        {displayUserType && <p className="text-xs text-text-muted">{displayUserType}</p>}
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
                        {userAvatar ? (
                            <img
                                src={userAvatar}
                                alt={userName}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-primary font-bold text-sm">
                                {userInitials}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
