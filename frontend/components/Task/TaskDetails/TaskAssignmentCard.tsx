import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import UserSelector from '../../Shared/UserSelector';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';

interface TaskAssignmentCardProps {
    task: Task;
    onAssign: (userId: number) => Promise<void>;
    onUnassign: () => Promise<void>;
}

const TaskAssignmentCard: React.FC<TaskAssignmentCardProps> = ({
    task,
    onAssign,
    onUnassign,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(
        task.assigned_to_user_id || null
    );
    const currentUser = useStore((state) => state.currentUser);

    const handleAssign = async () => {
        if (!selectedUserId) return;

        setIsLoading(true);
        try {
            await onAssign(selectedUserId);
            setIsEditing(false);
        } catch (error) {
            console.error('Error assigning task:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnassign = async () => {
        setIsLoading(true);
        try {
            await onUnassign();
            setSelectedUserId(null);
            setIsEditing(false);
        } catch (error) {
            console.error('Error unassigning task:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setSelectedUserId(task.assigned_to_user_id || null);
        setIsEditing(false);
    };

    const getAssigneeDisplayName = () => {
        if (!task.AssignedTo) return '';
        if (task.AssignedTo.name || task.AssignedTo.surname) {
            return `${task.AssignedTo.name || ''} ${task.AssignedTo.surname || ''}`.trim();
        }
        return task.AssignedTo.email;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                    <UserIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">
                        {t('task.assignedTo', 'Assigned To')}
                    </span>
                </div>
            </div>

            {!isEditing && task.AssignedTo ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {task.AssignedTo.avatar_image ? (
                                <img
                                    src={task.AssignedTo.avatar_image}
                                    alt={getAssigneeDisplayName()}
                                    className="h-8 w-8 rounded-full mr-3"
                                />
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm mr-3">
                                    {(
                                        task.AssignedTo.name?.[0] ||
                                        task.AssignedTo.email[0]
                                    ).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {getAssigneeDisplayName()}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {task.AssignedTo.email}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            disabled={isLoading}
                        >
                            {t('common.change', 'Change')}
                        </button>
                    </div>

                    <button
                        onClick={handleUnassign}
                        disabled={isLoading}
                        className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading
                            ? t('common.loading', 'Loading...')
                            : t('task.unassign', 'Unassign')}
                    </button>
                </div>
            ) : !isEditing ? (
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                    {t('task.assignToUser', 'Assign to user')}
                </button>
            ) : (
                <div className="space-y-3">
                    <UserSelector
                        selectedUserId={selectedUserId}
                        onChange={setSelectedUserId}
                        excludeUserIds={currentUser ? [currentUser.id] : []}
                        placeholder={t(
                            'task.selectUser',
                            'Select user to assign...'
                        )}
                        allowClear={true}
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={handleAssign}
                            disabled={!selectedUserId || isLoading}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading
                                ? t('common.saving', 'Saving...')
                                : t('task.assign', 'Assign')}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="flex-1 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskAssignmentCard;
