import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import RecurrenceDisplay from '../RecurrenceDisplay';
import TaskRecurrenceSection from '../TaskForm/TaskRecurrenceSection';
import TaskRecurringInstanceInfo from './TaskRecurringInstanceInfo';
import { Task, RecurrenceType } from '../../../entities/Task';
import { TaskIteration } from '../../../utils/tasksService';

interface TaskRecurrenceCardProps {
    task: Task;
    parentTask: Task | null;
    loadingParent: boolean;
    isEditing: boolean;
    recurrenceForm: {
        recurrence_type: RecurrenceType;
        recurrence_interval: number;
        recurrence_end_date: string | null;
        recurrence_weekday: number | null;
        recurrence_weekdays: number[] | null;
        recurrence_month_day: number | null;
        recurrence_week_of_month: number | null;
        completion_based: boolean;
    };
    onStartEdit: () => void;
    onChange: (field: string, value: any) => void;
    onSave: () => void;
    onCancel: () => void;
    loadingIterations: boolean;
    nextIterations: TaskIteration[];
    canEdit: boolean;
}

const TaskRecurrenceCard: React.FC<TaskRecurrenceCardProps> = ({
    task,
    parentTask,
    loadingParent,
    isEditing,
    recurrenceForm,
    onStartEdit,
    onChange,
    onSave,
    onCancel,
    loadingIterations,
    nextIterations,
    canEdit,
}) => {
    const { t, i18n } = useTranslation();

    const formatDateWithDayName = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date().toISOString().split('T')[0];
        const isToday = dateString === today;

        const dayName = date.toLocaleDateString(i18n.language, {
            weekday: 'long',
        });
        const formattedDate = date.toLocaleDateString(i18n.language, {
            day: 'numeric',
            month: 'long',
        });

        return {
            dayName,
            formattedDate,
            fullText: `${dayName}, ${formattedDate}`,
            isToday,
        };
    };

    const renderNextIterations = () => {
        if (loadingIterations) {
            return (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </span>
                </div>
            );
        }

        if (nextIterations.length === 0) {
            return (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'task.noUpcomingOccurrences',
                        'No upcoming occurrences.'
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {nextIterations.map((iteration, index) => {
                    const dateInfo = formatDateWithDayName(iteration.date);
                    return (
                        <div
                            key={index}
                            className={`flex items-center py-2 px-3 rounded transition-colors ${
                                dateInfo.isToday
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800'
                                    : 'bg-gray-50 dark:bg-gray-800 border border-transparent'
                            }`}
                        >
                            <div className="flex-1">
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                    {dateInfo.formattedDate}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {dateInfo.dayName}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.recurringSetup', 'Recurring Setup')}
            </h4>
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 space-y-4 ${
                    canEdit && !isEditing ? 'cursor-pointer' : ''
                }`}
                onClick={canEdit && !isEditing ? onStartEdit : undefined}
                role={canEdit && !isEditing ? 'button' : undefined}
                tabIndex={canEdit && !isEditing ? 0 : -1}
                onKeyDown={(e) => {
                    if (canEdit && !isEditing && e.key === 'Enter') {
                        e.preventDefault();
                        onStartEdit();
                    }
                }}
            >
                <TaskRecurringInstanceInfo
                    task={task}
                    parentTask={parentTask}
                    loadingParent={loadingParent}
                />

                {isEditing && canEdit ? (
                    <div className="space-y-4">
                        <TaskRecurrenceSection
                            recurrenceType={recurrenceForm.recurrence_type}
                            recurrenceInterval={
                                recurrenceForm.recurrence_interval
                            }
                            recurrenceEndDate={
                                recurrenceForm.recurrence_end_date || undefined
                            }
                            recurrenceWeekday={
                                recurrenceForm.recurrence_weekday || undefined
                            }
                            recurrenceWeekdays={
                                recurrenceForm.recurrence_weekdays || []
                            }
                            recurrenceMonthDay={
                                recurrenceForm.recurrence_month_day || undefined
                            }
                            recurrenceWeekOfMonth={
                                recurrenceForm.recurrence_week_of_month ||
                                undefined
                            }
                            completionBased={recurrenceForm.completion_based}
                            onChange={onChange}
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
                    <>
                        {(task.recurrence_type &&
                            task.recurrence_type !== 'none') ||
                        (parentTask?.recurrence_type &&
                            parentTask.recurrence_type !== 'none') ? (
                            <div className="mb-4">
                                <RecurrenceDisplay
                                    recurrenceType={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_type
                                            ? parentTask.recurrence_type
                                            : task.recurrence_type
                                    }
                                    recurrenceInterval={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_interval
                                            ? parentTask.recurrence_interval
                                            : task.recurrence_interval
                                    }
                                    recurrenceWeekdays={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_weekdays
                                            ? parentTask.recurrence_weekdays
                                            : task.recurrence_weekdays
                                    }
                                    recurrenceEndDate={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_end_date
                                            ? parentTask.recurrence_end_date
                                            : task.recurrence_end_date
                                    }
                                    recurrenceMonthDay={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_month_day
                                            ? parentTask.recurrence_month_day
                                            : task.recurrence_month_day
                                    }
                                    recurrenceWeekOfMonth={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_week_of_month
                                            ? parentTask.recurrence_week_of_month
                                            : task.recurrence_week_of_month
                                    }
                                    recurrenceWeekday={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_weekday
                                            ? parentTask.recurrence_weekday
                                            : task.recurrence_weekday
                                    }
                                    completionBased={
                                        task.recurring_parent_id &&
                                        parentTask?.completion_based
                                            ? parentTask.completion_based
                                            : task.completion_based
                                    }
                                />
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                {t(
                                    'task.notRecurring',
                                    'This task is not recurring yet.'
                                )}
                            </div>
                        )}

                        {((task.recurrence_type &&
                            task.recurrence_type !== 'none') ||
                            (task.recurring_parent_id &&
                                parentTask?.recurrence_type &&
                                parentTask.recurrence_type !== 'none')) && (
                            <div>
                                <div className="flex items-center mb-3">
                                    <ClockIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {task.recurring_parent_id
                                            ? t(
                                                  'task.nextOccurrencesAfterThis',
                                                  'Next Occurrences After This'
                                              )
                                            : t(
                                                  'task.nextOccurrences',
                                                  'Next Occurrences'
                                              )}
                                        {!loadingIterations &&
                                            nextIterations.length > 0 &&
                                            nextIterations.some(
                                                (iter) =>
                                                    formatDateWithDayName(
                                                        iter.date
                                                    ).isToday
                                            ) && (
                                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                    (
                                                    {t(
                                                        'task.includingToday',
                                                        'including today'
                                                    )}
                                                    )
                                                </span>
                                            )}
                                    </span>
                                </div>
                                {renderNextIterations()}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskRecurrenceCard;
