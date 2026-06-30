import { useEffect, useRef } from 'react';

const NotificationDropdown = ({ notifications, onMarkAsRead, onMarkAllAsRead, onClose, bellButtonRef }) => {
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside (but not on bell button)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Don't close if clicking on bell button or dropdown
            const clickedBell = bellButtonRef?.current?.contains(event.target);
            const clickedDropdown = dropdownRef.current?.contains(event.target);

            if (!clickedBell && !clickedDropdown) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, bellButtonRef]);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-96 bg-surface-dark border border-border-dark rounded-lg shadow-2xl z-50 max-h-[600px] flex flex-col"
        >
            {/* Header */}
            <div className="p-4 border-b border-border-dark flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                        <p className="text-xs text-text-muted mt-1">{unreadCount} unread</p>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-xs text-primary hover:text-green-400 transition-colors"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <span className="material-symbols-outlined text-text-muted text-5xl mb-3 block">
                            notifications_off
                        </span>
                        <p className="text-text-muted">No notifications yet</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <NotificationItem
                            key={notif.id}
                            notification={notif}
                            onMarkAsRead={onMarkAsRead}
                            formatTimestamp={formatTimestamp}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const NotificationItem = ({ notification, onMarkAsRead, formatTimestamp }) => {
    const handleClick = () => {
        if (!notification.isRead) {
            onMarkAsRead(notification.id);
        }
    };

    const isAddition = notification.metadata?.action === 'add';

    return (
        <div
            onClick={handleClick}
            className={`p-4 border-b border-border-dark cursor-pointer hover:bg-white/5 transition-colors ${!notification.isRead ? 'bg-primary/5' : ''
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Icon based on action */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAddition ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                    <span className={`material-symbols-outlined ${isAddition ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {isAddition ? 'add_circle' : 'remove_circle'}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-white text-sm">{notification.title}</p>
                        {!notification.isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1"></div>
                        )}
                    </div>
                    <p className="text-text-muted text-xs mt-1 break-words">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-text-muted text-xs">
                            {formatTimestamp(notification.createdAt)}
                        </span>
                        {notification.metadata?.admin_email && (
                            <>
                                <span className="text-text-muted text-xs">•</span>
                                <span className="text-text-muted text-xs truncate">
                                    {notification.metadata.admin_email}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationDropdown;
