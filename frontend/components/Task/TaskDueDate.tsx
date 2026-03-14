import React from 'react';
import { useTranslation } from 'react-i18next';
import { parseDateString, getTodayDateString, getTomorrowDateString, getYesterdayDateString } from '../../utils/dateUtils';

interface TaskDueDateProps {
    dueDate: string;
    className?: string;
}

const TaskDueDate: React.FC<TaskDueDateProps> = ({ dueDate, className }) => {
    const { t } = useTranslation();
    const getDueDateClass = () => {
        const today = getTodayDateString();
        const tomorrow = getTomorrowDateString();

        if (dueDate === today) return 'border-blue-700 dark:text-white';
        if (dueDate === tomorrow) return 'border-blue-700 dark:text-white';
        if (dueDate < today) return 'border-red-700 dark:text-white';
        return 'border-gray-300 dark:text-white';
    };

    const formatDueDate = () => {
        const today = getTodayDateString();
        const tomorrow = getTomorrowDateString();
        const yesterday = getYesterdayDateString();

        if (dueDate === today) return t('dateIndicators.today', 'TODAY');
        if (dueDate === tomorrow)
            return t('dateIndicators.tomorrow', 'TOMORROW');
        if (dueDate === yesterday)
            return t('dateIndicators.yesterday', 'YESTERDAY');

        const date = parseDateString(dueDate);
        if (!date) return dueDate;
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div
            className={`flex items-center text-xs py-1 px-2 rounded-md border ${getDueDateClass()} ${className}`}
        >
            {formatDueDate()}
        </div>
    );
};

export default TaskDueDate;
