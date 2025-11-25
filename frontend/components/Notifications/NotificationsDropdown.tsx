import React, { useState, useRef, useEffect } from 'react';
import {
    BellIcon,
    CheckIcon,
    XMarkIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getApiPath } from '../../config/paths';

interface Notification {
    id: number;
    title: string;
    message: string;
    level: 'info' | 'warning' | 'error' | 'success';
    source: string;
    is_read: boolean;
    created_at: string;
    data?: {
        taskUid?: string;
        projectUid?: string;
        [key: string]: any;
    };
}

interface NotificationsDropdownProps {
    isDarkMode: boolean;
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
    isDarkMode,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchUnreadCount = async () => {
        try {
            const response = await fetch(
                getApiPath('notifications/unread-count'),
                {
                    credentials: 'include',
                }
            );
            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count || 0);
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                getApiPath('notifications?limit=20&includeRead=true'),
                {
                    credentials: 'include',
                }
            );
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            const response = await fetch(
                getApiPath(`notifications/${id}/read`),
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );
            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
                );
                fetchUnreadCount();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const response = await fetch(
                getApiPath('notifications/mark-all-read'),
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );
            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => ({ ...n, is_read: true }))
                );
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(getApiPath(`notifications/${id}`), {
                method: 'DELETE',
                credentials: 'include',
            });
            if (response.ok) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
                fetchUnreadCount();
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'success':
                return (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                );
            case 'warning':
                return (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                );
            case 'error':
                return (
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                );
            default:
                return (
                    <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                );
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t('notifications.justNow', 'Just now');
        if (minutes < 60)
            return t('notifications.minutesAgo', '{{count}} min ago', {
                count: minutes,
            });
        if (hours < 24)
            return t('notifications.hoursAgo', '{{count}}h ago', {
                count: hours,
            });
        if (days < 7)
            return t('notifications.daysAgo', '{{count}}d ago', {
                count: days,
            });
        return date.toLocaleDateString();
    };

    const handleNotificationClick = (notification: Notification) => {
        if (notification.data?.taskUid) {
            setIsOpen(false);
            navigate(`/task/${notification.data.taskUid}`);
        } else if (notification.data?.projectUid) {
            setIsOpen(false);
            navigate(`/project/${notification.data.projectUid}`);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="relative flex items-center focus:outline-none"
                aria-label="Notifications"
            >
                <BellIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-medium">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className={`absolute right-0 mt-2 w-96 rounded-lg shadow-lg z-50 ${
                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                    } border ${
                        isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                >
                    <div
                        className={`p-4 border-b flex items-center justify-between ${
                            isDarkMode ? 'border-gray-700' : 'border-gray-200'
                        }`}
                    >
                        <h3 className="text-lg font-semibold">
                            {t('notifications.title', 'Notifications')}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                {t(
                                    'notifications.markAllRead',
                                    'Mark all as read'
                                )}
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('notifications.loading', 'Loading...')}
                                </p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t(
                                        'notifications.noNotifications',
                                        'No notifications yet'
                                    )}
                                </p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b ${
                                        isDarkMode
                                            ? 'border-gray-700'
                                            : 'border-gray-200'
                                    } ${
                                        !notification.is_read
                                            ? isDarkMode
                                                ? 'bg-gray-700/50'
                                                : 'bg-blue-50'
                                            : ''
                                    } hover:${
                                        isDarkMode
                                            ? 'bg-gray-700'
                                            : 'bg-gray-50'
                                    } transition-colors`}
                                >
                                    <div className="flex items-start space-x-3">
                                        {getLevelIcon(notification.level)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div
                                                    className={`flex-1 ${
                                                        notification.data
                                                            ?.taskUid ||
                                                        notification.data
                                                            ?.projectUid
                                                            ? 'cursor-pointer'
                                                            : ''
                                                    }`}
                                                    onClick={() =>
                                                        handleNotificationClick(
                                                            notification
                                                        )
                                                    }
                                                >
                                                    <p className="text-sm font-medium">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                        {formatTimestamp(
                                                            notification.created_at
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center space-x-1 ml-2">
                                                    {!notification.is_read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsRead(
                                                                    notification.id
                                                                );
                                                            }}
                                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                                            title={t(
                                                                'notifications.markAsRead',
                                                                'Mark as read'
                                                            )}
                                                        >
                                                            <CheckIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(
                                                                notification.id
                                                            );
                                                        }}
                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                                        title={t(
                                                            'notifications.delete',
                                                            'Delete'
                                                        )}
                                                    >
                                                        <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsDropdown;
