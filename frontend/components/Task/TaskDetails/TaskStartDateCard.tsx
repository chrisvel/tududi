import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon } from '@heroicons/react/24/outline';
import TaskDueDateSection from '../TaskForm/TaskDueDateSection';
import { Task } from '../../../entities/Task';
import {
    parseDateString,
    formatDateByCountry,
    getUserTimezone,
} from '../../../utils/dateUtils';
import { getCountryFromTimezone } from '../../../utils/localeUtils';

interface TaskStartDateCardProps {
    task: Task;
    isEditing: boolean;
    editedStartDate: string;
    onChangeDate: (value: string) => void;
    editedStartTime: string;
    onChangeTime: (value: string) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const TaskStartDateCard: React.FC<TaskStartDateCardProps> = ({
    task,
    isEditing,
    editedStartDate,
    onChangeDate,
    editedStartTime,
    onChangeTime,
    onStartEdit,
    onSave,
    onCancel,
}) => {
    const { t } = useTranslation();

    const formatted = (() => {
        const date = task.start_date ? parseDateString(task.start_date) : null;
        if (!date) return null;
        const country = getCountryFromTimezone(getUserTimezone());
        return formatDateByCountry(date, country);
    })();

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.startDate', 'Start')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors">
                {isEditing ? (
                    <div className="space-y-3">
                        <TaskDueDateSection
                            value={editedStartDate}
                            onChange={onChangeDate}
                            time={editedStartTime}
                            onTimeChange={onChangeTime}
                            placeholder={t(
                                'forms.task.startDatePlaceholder',
                                'Select start date'
                            )}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={onSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onStartEdit}
                        className="flex w-full items-center text-left"
                    >
                        {formatted ? (
                            <span className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                                <PlayIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm font-medium">
                                    {formatted}
                                    {task.start_time && ` ${task.start_time}`}
                                </span>
                            </span>
                        ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('task.noStartDate', 'No start date')}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TaskStartDateCard;
