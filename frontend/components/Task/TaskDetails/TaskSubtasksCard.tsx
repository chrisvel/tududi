import React, { useState } from 'react';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Project } from '../../../entities/Project';
import { Task } from '../../../entities/Task';
import TaskItem from '../TaskItem';

interface TaskSubtasksCardProps {
    subtasks: Task[];
    projects: Project[];
    onSubtaskUpdate: (updatedSubtask: Task) => Promise<void>;
    onSubtaskDelete: (taskUid: string) => void;
    onQuickAdd: (name: string) => void;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({
    subtasks,
    projects,
    onSubtaskUpdate,
    onSubtaskDelete,
    onQuickAdd,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const { t } = useTranslation();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newSubtaskName.trim()) {
            e.preventDefault();
            onQuickAdd(newSubtaskName.trim());
            setNewSubtaskName('');
        }
    };

    return (
        <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                {t('subtasks.title', 'Subtasks')}
                {subtasks.length > 0 && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        ({subtasks.length})
                    </span>
                )}
            </h3>

            {subtasks.length > 0 && (
                <div className="space-y-1 mb-1">
                    {subtasks.map((subtask) => (
                        <TaskItem
                            key={subtask.id ?? subtask.uid}
                            task={subtask}
                            onTaskUpdate={onSubtaskUpdate}
                            onTaskDelete={onSubtaskDelete}
                            projects={projects}
                            hideProjectName
                        />
                    ))}
                </div>
            )}

            <div className="group flex items-center py-3 px-4 rounded-lg shadow-sm bg-white dark:bg-gray-900 transition-all duration-200 ease-in-out hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-700 focus-within:ring-1 focus-within:ring-blue-300 dark:focus-within:ring-blue-500 cursor-text">
                <PlusCircleIcon className="h-5 w-5 mr-3 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-colors duration-200 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-focus-within:text-blue-400 dark:group-focus-within:text-blue-400" />
                <input
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('subtasks.placeholder', 'Add a subtask...')}
                    className="text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 bg-transparent focus:outline-none focus:ring-0 w-full cursor-text"
                />
            </div>
        </div>
    );
};

export default TaskSubtasksCard;
