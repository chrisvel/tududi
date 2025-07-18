import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import TaskPriorityIcon from '../TaskPriorityIcon';
import { toggleTaskCompletion } from '../../../utils/tasksService';

interface TaskSubtasksSectionProps {
    parentTaskId: number;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSectionMount?: () => void;
    onSubtaskUpdate?: (subtask: Task) => Promise<void>;
}

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({
    parentTaskId,
    subtasks,
    onSubtasksChange,
    onSectionMount,
    onSubtaskUpdate,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const { t } = useTranslation();
    const subtasksSectionRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (onSectionMount) {
            scrollToBottom();
            onSectionMount();
        }
    }, [onSectionMount]);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (subtasksSectionRef.current) {
                subtasksSectionRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                });
            }
        }, 100);
    };

    const handleCreateSubtask = () => {
        if (!newSubtaskName.trim()) return;

        const newSubtask: Task = {
            name: newSubtaskName.trim(),
            status: 'not_started',
            priority: 'medium',
            today: false,
            parent_task_id: parentTaskId, // Set the parent task ID immediately
            // Mark as new for backend processing
            isNew: true,
            // Also keep for UI purposes  
            _isNew: true,
        } as Task;

        onSubtasksChange([...subtasks, newSubtask]);
        setNewSubtaskName('');

        // Scroll to bottom after adding new subtask
        scrollToBottom();
    };

    const handleDeleteSubtask = (index: number) => {
        const updatedSubtasks = subtasks.filter((_, i) => i !== index);
        onSubtasksChange(updatedSubtasks);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateSubtask();
        }
    };

    const handleEditSubtask = (index: number) => {
        setEditingIndex(index);
        setEditingName(subtasks[index].name);
    };

    const handleSaveEdit = () => {
        if (!editingName.trim() || editingIndex === null) return;

        const updatedSubtasks = subtasks.map((subtask, index) => {
            if (index === editingIndex) {
                const isNameChanged = subtask.name !== editingName.trim();
                const isNew = (subtask as any)._isNew || (subtask as any).isNew || false;
                const isEdited = !isNew && isNameChanged;
                return {
                    ...subtask,
                    name: editingName.trim(),
                    // Backend flags
                    isNew: isNew,
                    isEdited: isEdited,
                    // UI flags
                    _isNew: isNew,
                    _isEdited: isEdited,
                };
            }
            return subtask;
        });

        onSubtasksChange(updatedSubtasks);
        setEditingIndex(null);
        setEditingName('');
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingName('');
    };

    return (
        <div ref={subtasksSectionRef} className="space-y-3">
            {/* Existing Subtasks */}
            {isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                <div className="space-y-1">
                    {subtasks.map((subtask, index) => (
                        <div
                            key={subtask.id || index}
                            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800"
                        >
                            {editingIndex === index ? (
                                <div className="px-3 py-2.5 flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <TaskPriorityIcon
                                            priority={
                                                subtask.priority || 'medium'
                                            }
                                            status={
                                                subtask.status || 'not_started'
                                            }
                                            onToggleCompletion={async () => {
                                                if (
                                                    subtask.id &&
                                                    onSubtaskUpdate
                                                ) {
                                                    try {
                                                        const updatedSubtask =
                                                            await toggleTaskCompletion(
                                                                subtask.id
                                                            );
                                                        await onSubtaskUpdate(
                                                            updatedSubtask
                                                        );
                                                    } catch (error) {
                                                        console.error(
                                                            'Error toggling subtask completion:',
                                                            error
                                                        );
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) =>
                                            setEditingName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveEdit();
                                            } else if (e.key === 'Escape') {
                                                handleCancelEdit();
                                            }
                                        }}
                                        onBlur={handleSaveEdit}
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                                        title={t('actions.cancel', 'Cancel')}
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="px-3 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        <div className="flex-shrink-0">
                                            <TaskPriorityIcon
                                                priority={
                                                    subtask.priority || 'medium'
                                                }
                                                status={
                                                    subtask.status ||
                                                    'not_started'
                                                }
                                                onToggleCompletion={async () => {
                                                    if (
                                                        subtask.id &&
                                                        onSubtaskUpdate
                                                    ) {
                                                        try {
                                                            const updatedSubtask =
                                                                await toggleTaskCompletion(
                                                                    subtask.id
                                                                );
                                                            await onSubtaskUpdate(
                                                                updatedSubtask
                                                            );
                                                        } catch (error) {
                                                            console.error(
                                                                'Error toggling subtask completion:',
                                                                error
                                                            );
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                        <span
                                            className={`text-sm flex-1 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${
                                                subtask.status === 'done' ||
                                                subtask.status === 2 ||
                                                subtask.status === 'archived' ||
                                                subtask.status === 3
                                                    ? 'text-gray-500 dark:text-gray-400'
                                                    : 'text-gray-900 dark:text-gray-100'
                                            }`}
                                            onClick={() =>
                                                handleEditSubtask(index)
                                            }
                                            title={t(
                                                'actions.clickToEdit',
                                                'Click to edit'
                                            )}
                                        >
                                            {subtask.name}
                                            {(subtask as any)._isNew && (
                                                <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">
                                                    (new)
                                                </span>
                                            )}
                                            {(subtask as any)._isEdited && (
                                                <span className="ml-2 text-xs text-orange-500 dark:text-orange-400">
                                                    (edited)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleDeleteSubtask(index)
                                        }
                                        className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                        title={t('actions.delete', 'Delete')}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('subtasks.noSubtasks', 'No subtasks yet')}
                </div>
            )}

            {/* Add New Subtask */}
            <div className="flex items-center space-x-2">
                <input
                    ref={addInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('subtasks.placeholder', 'Add a subtask...')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                    type="button"
                    onClick={handleCreateSubtask}
                    disabled={!newSubtaskName.trim()}
                    className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('actions.add', 'Add')}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default TaskSubtasksSection;
