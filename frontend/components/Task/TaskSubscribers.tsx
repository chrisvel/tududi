import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BellIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    subscribeToTask,
    unsubscribeFromTask,
} from '../../utils/tasksService';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';

interface TaskSubscribersProps {
    task: Task;
    currentUserId: number;
    onUpdate?: (updatedTask: Task) => void;
}

const TaskSubscribers: React.FC<TaskSubscribersProps> = ({
    task,
    currentUserId,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [showManageModal, setShowManageModal] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const subscribers = task.Subscribers || [];
    const isCurrentUserSubscribed = subscribers.some(
        (sub) => sub.id === currentUserId
    );

    useEffect(() => {
        if (showManageModal) {
            fetchAllUsers();
        }
    }, [showManageModal]);

    const fetchAllUsers = async () => {
        try {
            const response = await fetch(getApiPath('users'), {
                credentials: 'include',
                headers: getDefaultHeaders(),
            });

            if (response.ok) {
                const users = await response.json();
                setAllUsers(users);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const handleSubscribe = async (userId: number) => {
        if (!task.uid) return;

        setLoading(true);
        setError(null);

        try {
            const updatedTask = await subscribeToTask(task.uid, userId);
            if (onUpdate) {
                onUpdate(updatedTask);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to subscribe');
            console.error('Error subscribing:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnsubscribe = async (userId: number) => {
        if (!task.uid) return;

        setLoading(true);
        setError(null);

        try {
            const updatedTask = await unsubscribeFromTask(task.uid, userId);
            if (onUpdate) {
                onUpdate(updatedTask);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to unsubscribe');
            console.error('Error unsubscribing:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSubscription = () => {
        if (isCurrentUserSubscribed) {
            handleUnsubscribe(currentUserId);
        } else {
            handleSubscribe(currentUserId);
        }
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <BellIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('task.subscribers', 'Subscribers')}
                    </label>
                </div>
                <button
                    onClick={() => setShowManageModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                >
                    <UserPlusIcon className="h-4 w-4" />
                    <span>{t('task.manage_subscribers', 'Manage')}</span>
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Subscribers list */}
            <div className="space-y-2">
                {subscribers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {subscribers.map((subscriber) => (
                            <div
                                key={subscriber.id}
                                className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1"
                            >
                                {subscriber.avatar_image ? (
                                    <img
                                        src={getApiPath(subscriber.avatar_image)}
                                        alt={subscriber.name || subscriber.email}
                                        className="h-6 w-6 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                        {(subscriber.name || subscriber.email)[0].toUpperCase()}
                                    </div>
                                )}
                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                    {subscriber.name || subscriber.email}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('task.no_subscribers', 'No subscribers')}
                    </p>
                )}
            </div>

            {/* Subscribe/Unsubscribe button */}
            <div>
                <button
                    onClick={handleToggleSubscription}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading
                        ? t('common.loading', 'Loading...')
                        : isCurrentUserSubscribed
                          ? t('task.unsubscribe_me', 'Unsubscribe me')
                          : t('task.subscribe_me', 'Subscribe me')}
                </button>
            </div>

            {/* Manage subscribers modal */}
            {showManageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('task.manage_subscribers', 'Manage Subscribers')}
                            </h3>
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-4 overflow-y-auto flex-1">
                            <div className="space-y-2">
                                {allUsers.map((user) => {
                                    const isSubscribed = subscribers.some(
                                        (sub) => sub.id === user.id
                                    );
                                    const isCurrentUser = user.id === currentUserId;

                                    return (
                                        <div
                                            key={user.id}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {user.avatar_image ? (
                                                    <img
                                                        src={getApiPath(user.avatar_image)}
                                                        alt={user.name || user.email}
                                                        className="h-8 w-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
                                                        {(user.name || user.email)[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.name || user.email}
                                                        {isCurrentUser && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                ({t('common.you', 'You')})
                                                            </span>
                                                        )}
                                                    </p>
                                                    {user.name && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    isSubscribed
                                                        ? handleUnsubscribe(user.id)
                                                        : handleSubscribe(user.id)
                                                }
                                                disabled={loading}
                                                className={`px-3 py-1 text-sm rounded ${
                                                    isSubscribed
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {isSubscribed
                                                    ? t('common.remove', 'Remove')
                                                    : t('common.add', 'Add')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            >
                                {t('common.done', 'Done')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskSubscribers;
