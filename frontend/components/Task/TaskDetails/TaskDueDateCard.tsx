import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import TaskDueDateSection from '../TaskForm/TaskDueDateSection';
import { Task } from '../../../entities/Task';

interface TaskDueDateCardProps {
    task: Task;
    isEditing: boolean;
    editedDueDate: string;
    onChangeDate: (value: string) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const TaskDueDateCard: React.FC<TaskDueDateCardProps> = ({
    task,
    isEditing,
    editedDueDate,
    onChangeDate,
    onStartEdit,
    onSave,
    onCancel,
}) => {
    const { t, i18n } = useTranslation();

    const getDueDateDisplay = (dueDate: string) => {
        const date = new Date(dueDate);
        if (Number.isNaN(date.getTime())) return null;

        const formattedDate = date.toLocaleDateString(i18n.language, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        const diffDays = Math.round(
            (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let relativeText = '';
        if (diffDays === 0) {
            relativeText = t('dateIndicators.today', 'today');
        } else if (diffDays === 1) {
            relativeText = t('dateIndicators.tomorrow', 'tomorrow');
        } else if (diffDays === -1) {
            relativeText = t('dateIndicators.yesterday', 'yesterday');
        } else if (diffDays > 0) {
            relativeText = t('task.inDays', 'in {{count}} days', {
                count: diffDays,
            });
        } else {
            relativeText = t('task.daysAgo', '{{count}} days ago', {
                count: Math.abs(diffDays),
            });
        }

        return { formattedDate, relativeText };
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.dueDate', 'Due Date')}
            </h4>
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors ${
                    task.due_date &&
                    (() => {
                        const dueDate = new Date(task.due_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        dueDate.setHours(0, 0, 0, 0);
                        const isCompleted =
                            task.status === 'done' ||
                            task.status === 2 ||
                            task.status === 'archived' ||
                            task.status === 3 ||
                            task.completed_at;
                        return dueDate < today && !isCompleted;
                    })()
                        ? 'border-red-500 dark:border-red-400'
                        : ''
                }`}
            >
                {isEditing ? (
                    <div className="space-y-3">
                        <TaskDueDateSection
                            value={editedDueDate}
                            onChange={onChangeDate}
                            placeholder={t(
                                'forms.task.dueDatePlaceholder',
                                'Select due date'
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
                        className="flex w-full items-center justify-between text-left"
                    >
                        {task.due_date ? (
                            (() => {
                                const display = getDueDateDisplay(
                                    task.due_date
                                );
                                if (!display) return null;
                                const dueDate = new Date(task.due_date);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                dueDate.setHours(0, 0, 0, 0);
                                const isCompleted =
                                    task.status === 'done' ||
                                    task.status === 2 ||
                                    task.status === 'archived' ||
                                    task.status === 3 ||
                                    task.completed_at;
                                const overdue = dueDate < today && !isCompleted;

                                return (
                                    <div
                                        className={`flex items-center justify-between w-full ${
                                            overdue
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            <CalendarIcon
                                                className={`h-4 w-4 flex-shrink-0 ${
                                                    overdue
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            />
                                            <span className="text-sm font-medium">
                                                {display.formattedDate}
                                            </span>
                                            <span
                                                className={`text-sm italic ${
                                                    overdue
                                                        ? 'text-red-500 dark:text-red-400 font-medium'
                                                        : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            >
                                                ({display.relativeText})
                                            </span>
                                        </div>
                                        {overdue && (
                                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 ml-2" />
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('task.noDueDate', 'No due date')}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TaskDueDateCard;
