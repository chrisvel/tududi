import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon } from '@heroicons/react/24/outline';
import SearchableUserDropdown from '../../Shared/SearchableUserDropdown';
import { Task } from '../../../entities/Task';

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
    const [isLoading, setIsLoading] = useState(false);

    const handleAssignmentChange = async (userId: number | null) => {
        setIsLoading(true);
        try {
            if (userId === null) {
                await onUnassign();
            } else {
                await onAssign(userId);
            }
        } catch (error) {
            console.error('Error updating assignment:', error);
            throw error; // Re-throw to let dropdown handle error state
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
            <div className="flex items-center mb-3">
                <UserIcon className="h-5 w-5 mr-2 text-gray-700 dark:text-gray-300" />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('task.assignedTo', 'Assigned To')}
                </span>
            </div>

            <SearchableUserDropdown
                selectedUserId={task.assigned_to_user_id || null}
                onChange={handleAssignmentChange}
                disabled={isLoading}
            />
        </div>
    );
};

export default TaskAssignmentCard;
