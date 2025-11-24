import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import TaskDeferUntilSection from '../TaskForm/TaskDeferUntilSection';
import { Task } from '../../../entities/Task';

interface TaskDeferUntilCardProps {
    task: Task;
    isEditing: boolean;
    editedDeferUntil: string;
    onChangeDateTime: (value: string) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const TaskDeferUntilCard: React.FC<TaskDeferUntilCardProps> = ({
    task,
    isEditing,
    editedDeferUntil,
    onChangeDateTime,
    onStartEdit,
    onSave,
    onCancel,
}) => {
    const { t, i18n } = useTranslation();

    const getDeferUntilDisplay = (deferUntil: string) => {
        const date = new Date(deferUntil);
        if (Number.isNaN(date.getTime())) return null;

        const formattedDateTime = date.toLocaleString(i18n.language, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        let relativeText = '';
        if (diffMins < 0) {
            if (diffDays < -1) {
                relativeText = t('task.daysAgo', '{{count}} days ago', {
                    count: Math.abs(diffDays),
                });
            } else if (diffHours < -1) {
                relativeText = t('task.hoursAgo', '{{count}} hours ago', {
                    count: Math.abs(diffHours),
                });
            } else {
                relativeText = t('task.minutesAgo', '{{count}} minutes ago', {
                    count: Math.abs(diffMins),
                });
            }
        } else if (diffMins < 60) {
            relativeText = t('task.inMinutes', 'in {{count}} minutes', {
                count: diffMins,
            });
        } else if (diffHours < 24) {
            relativeText = t('task.inHours', 'in {{count}} hours', {
                count: diffHours,
            });
        } else {
            relativeText = t('task.inDays', 'in {{count}} days', {
                count: diffDays,
            });
        }

        return { formattedDateTime, relativeText, isPast: diffMs < 0 };
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.deferUntil', 'Defer Until')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors">
                {isEditing ? (
                    <div className="space-y-3">
                        <TaskDeferUntilSection
                            value={editedDeferUntil}
                            onChange={onChangeDateTime}
                            placeholder={t(
                                'forms.task.deferUntilPlaceholder',
                                'Select defer until date and time'
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
                        {task.defer_until ? (
                            (() => {
                                const display = getDeferUntilDisplay(
                                    task.defer_until
                                );
                                if (!display) return null;

                                return (
                                    <div className="flex items-center space-x-2 flex-1 min-w-0 text-gray-900 dark:text-gray-100">
                                        <ClockIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                                        <span className="text-sm font-medium">
                                            {display.formattedDateTime}
                                        </span>
                                        <span className="text-sm italic text-gray-500 dark:text-gray-400">
                                            ({display.relativeText})
                                        </span>
                                    </div>
                                );
                            })()
                        ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('task.noDeferUntil', 'No defer until')}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TaskDeferUntilCard;
