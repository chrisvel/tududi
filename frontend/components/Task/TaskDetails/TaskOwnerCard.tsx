import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { getApiPath } from '../../../config/paths';

interface TaskOwnerCardProps {
    task: Task;
}

const TaskOwnerCard: React.FC<TaskOwnerCardProps> = ({ task }) => {
    const { t } = useTranslation();

    const getDisplayName = () => {
        if (!task.Owner) return t('task.unknownOwner', 'Unknown');

        const { name, surname, email } = task.Owner;

        if (name || surname) {
            return [name, surname].filter(Boolean).join(' ');
        }

        return email;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center mb-3">
                <UserCircleIcon className="h-5 w-5 mr-2 text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('task.createdBy', 'Created By')}
                </span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1">
                {task.Owner?.avatar_image ? (
                    <img
                        src={getApiPath(task.Owner.avatar_image)}
                        alt={getDisplayName()}
                        className="h-6 w-6 rounded-full object-cover"
                    />
                ) : (
                    <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <UserCircleIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-200">
                    {getDisplayName()}
                </span>
            </div>
        </div>
    );
};

export default TaskOwnerCard;
