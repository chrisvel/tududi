import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task, PriorityType } from '../../../entities/Task';

interface TaskPriorityCardProps {
    task: Task;
    onUpdate: (priority: PriorityType) => Promise<void>;
}

const TaskPriorityCard: React.FC<TaskPriorityCardProps> = ({
    task,
    onUpdate,
}) => {
    const { t } = useTranslation();

    const handlePriorityClick = async (priority: PriorityType) => {
        await onUpdate(priority);
    };

    return (
        <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.priority', 'Priority')}
            </h4>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                <button
                    type="button"
                    onClick={() => handlePriorityClick(null)}
                    className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                        task.priority === null || task.priority === undefined
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    {t('priority.none', 'None')}
                </button>
                <button
                    type="button"
                    onClick={() => handlePriorityClick('low')}
                    className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                        task.priority === 'low' || task.priority === 0
                            ? 'bg-blue-500 dark:bg-blue-600 text-white'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                    }`}
                >
                    {t('priority.low', 'Low')}
                </button>
                <button
                    type="button"
                    onClick={() => handlePriorityClick('medium')}
                    className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                        task.priority === 'medium' || task.priority === 1
                            ? 'bg-yellow-500 dark:bg-yellow-600 text-white'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                    }`}
                >
                    {t('priority.medium', 'Medium')}
                </button>
                <button
                    type="button"
                    onClick={() => handlePriorityClick('high')}
                    className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                        task.priority === 'high' || task.priority === 2
                            ? 'bg-red-500 dark:bg-red-600 text-white'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                    }`}
                >
                    {t('priority.high', 'High')}
                </button>
            </div>
        </div>
    );
};

export default TaskPriorityCard;
