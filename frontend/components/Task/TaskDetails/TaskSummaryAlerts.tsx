import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    XMarkIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { isTaskOverdue } from '../../../utils/dateUtils';

interface TaskSummaryAlertsProps {
    task: Task;
    summaryMessage: React.ReactNode;
    isSummaryDismissed: boolean;
    isOverdueDismissed: boolean;
    onDismissSummary: () => void;
    onDismissOverdue: () => void;
}

const TaskSummaryAlerts: React.FC<TaskSummaryAlertsProps> = ({
    task,
    summaryMessage,
    isSummaryDismissed,
    isOverdueDismissed,
    onDismissSummary,
    onDismissOverdue,
}) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Summary Alert */}
            {!isSummaryDismissed && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-r-lg relative">
                    <button
                        onClick={onDismissSummary}
                        className="absolute top-2 right-2 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                    <div className="flex items-center pr-8">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-300 mr-3 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                {summaryMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Overdue Alert */}
            {isTaskOverdue(task) && !isOverdueDismissed && (
                <div className="mb-6 mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg relative">
                    <button
                        onClick={onDismissOverdue}
                        className="absolute top-2 right-2 p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                    <div className="flex items-start pr-8">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                {t(
                                    'task.overdueAlert',
                                    "This task was in your plan yesterday and wasn't completed."
                                )}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                {t(
                                    'task.overdueYesterday',
                                    'Consider prioritizing this task or breaking it into smaller steps.'
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TaskSummaryAlerts;
