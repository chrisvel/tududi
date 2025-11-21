import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListBulletIcon } from '@heroicons/react/24/outline';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import TaskPriorityIcon from '../TaskPriorityIcon';
import { Task } from '../../../entities/Task';

interface TaskSubtasksCardProps {
    task: Task;
    subtasks: Task[];
    isEditing: boolean;
    editedSubtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onToggleSubtaskCompletion: (subtask: Task) => Promise<void>;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({
    task,
    subtasks,
    isEditing,
    editedSubtasks,
    onSubtasksChange,
    onStartEdit,
    onSave,
    onCancel,
    onToggleSubtaskCompletion,
}) => {
    const { t } = useTranslation();

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.subtasks', 'Subtasks')}
            </h4>
            {isEditing ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-6">
                    <TaskSubtasksSection
                        parentTaskId={task.id!}
                        subtasks={editedSubtasks}
                        onSubtasksChange={onSubtasksChange}
                    />
                    <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex space-x-2">
                            <button
                                onClick={onSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : subtasks.length > 0 ? (
                <div className="space-y-0.5">
                    {subtasks.map((subtask: Task) => (
                        <div
                            key={subtask.id}
                            className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 transition-all duration-200 ${
                                subtask.status === 'in_progress' ||
                                subtask.status === 1
                                    ? 'border-green-400/60 dark:border-green-500/60'
                                    : 'border-gray-50 dark:border-gray-800'
                            }`}
                        >
                            <div className="px-3 py-3 flex items-center space-x-3">
                                <TaskPriorityIcon
                                    priority={subtask.priority}
                                    status={subtask.status}
                                    onToggleCompletion={() =>
                                        onToggleSubtaskCompletion(subtask)
                                    }
                                />
                                <span
                                    onClick={onStartEdit}
                                    className={`text-base flex-1 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                        subtask.status === 'done' ||
                                        subtask.status === 2 ||
                                        subtask.status === 'archived' ||
                                        subtask.status === 3
                                            ? 'text-gray-500 dark:text-gray-400'
                                            : 'text-gray-900 dark:text-gray-100'
                                    }`}
                                    title={t(
                                        'task.clickToEditSubtasks',
                                        'Click to edit subtasks'
                                    )}
                                >
                                    {subtask.name}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    onClick={onStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t(
                        'task.clickToEditSubtasks',
                        'Click to add or edit subtasks'
                    )}
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <ListBulletIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t(
                                'task.noSubtasksClickToAdd',
                                'No subtasks yet, click to add'
                            )}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskSubtasksCard;
