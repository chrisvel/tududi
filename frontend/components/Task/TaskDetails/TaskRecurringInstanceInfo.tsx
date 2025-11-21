import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';

interface TaskRecurringInstanceInfoProps {
    task: Task;
    parentTask: Task | null;
    loadingParent: boolean;
}

const TaskRecurringInstanceInfo: React.FC<TaskRecurringInstanceInfoProps> = ({
    task,
    parentTask,
    loadingParent,
}) => {
    const { t } = useTranslation();

    if (!task.recurring_parent_id) {
        return null;
    }

    return (
        <div className="mb-6 p-4 rounded-lg shadow-sm bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-start gap-3">
                <ArrowPathIcon className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t(
                            'task.instanceOf',
                            'This is an instance of a recurring task'
                        )}
                    </p>
                    {loadingParent && (
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('common.loading', 'Loading parent task...')}
                            </span>
                        </div>
                    )}
                    {parentTask && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            <strong>
                                {t('task.parentTask', 'Parent Task')}:
                            </strong>{' '}
                            <Link
                                to={`/task/${parentTask.uid}`}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                            >
                                {parentTask.name}
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskRecurringInstanceInfo;
