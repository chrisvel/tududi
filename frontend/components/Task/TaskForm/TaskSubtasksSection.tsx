import React, { useState, useRef } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import TaskPriorityIcon from '../TaskPriorityIcon';
import { toggleTaskCompletion } from '../../../utils/tasksService';

interface TaskSubtasksSectionProps {
    parentTaskId: number;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSubtaskUpdate?: (subtask: Task) => Promise<void>;
}

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({
    parentTaskId,
    subtasks,
    onSubtasksChange,
    onSubtaskUpdate,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const { t } = useTranslation();
    const subtasksSectionRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            // Find the modal's scrollable container
            const modalScrollContainer = document.querySelector(
                '.absolute.inset-0.overflow-y-auto'
            );
            if (modalScrollContainer) {
                modalScrollContainer.scrollTo({
                    top: modalScrollContainer.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 100);
    };

    const handleCreateSubtask = () => {
        if (!newSubtaskName.trim()) return;

        const newSubtask: Task = {
            name: newSubtaskName.trim(),
            status: 'not_started',
            priority: 'low',
            today: false,
            parent_task_id: parentTaskId, // Set the parent task ID immediately
            // Mark as new for backend processing
            isNew: true,
            // Also keep for UI purposes
            _isNew: true,
            completed_at: null,
        } as Task;

        onSubtasksChange([...subtasks, newSubtask]);
        setNewSubtaskName('');

        // Only scroll when adding new subtask, not when toggling completion
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
                const isNew =
                    (subtask as any)._isNew || (subtask as any).isNew || false;
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

    const handleToggleNewSubtaskCompletion = (index: number) => {
        const updatedSubtasks = subtasks.map((subtask, i) => {
            if (i === index) {
                const isDone =
                    subtask.status === 'done' || subtask.status === 2;
                const newStatus = isDone
                    ? ('not_started' as const)
                    : ('done' as const);
                const hasId =
                    subtask.id &&
                    !((subtask as any)._isNew || (subtask as any).isNew);

                return {
                    ...subtask,
                    status: newStatus,
                    completed_at: isDone ? null : new Date().toISOString(),
                    // Mark for backend update if it has an ID (existing subtask)
                    _statusChanged: hasId,
                };
            }
            return subtask;
        });
        onSubtasksChange(updatedSubtasks);
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
                                <div className="px-3 py-2.5 flex items-center space-x-3 overflow-hidden">
                                    <div className="flex-shrink-0">
                                        <TaskPriorityIcon
                                            priority={subtask.priority || 'low'}
                                            status={
                                                subtask.status || 'not_started'
                                            }
                                            onToggleCompletion={async () => {
                                                if (
                                                    subtask.id &&
                                                    onSubtaskUpdate &&
                                                    !(
                                                        (subtask as any)
                                                            ._isNew ||
                                                        (subtask as any).isNew
                                                    )
                                                ) {
                                                    // Existing subtask - use API for immediate toggle, then update callback
                                                    try {
                                                        const updatedSubtask =
                                                            await toggleTaskCompletion(
                                                                subtask.uid!
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
                                                } else {
                                                    // New subtask or no callback - handle locally
                                                    handleToggleNewSubtaskCompletion(
                                                        index
                                                    );
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
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white overflow-hidden"
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
                                <div className="px-3 py-2.5 flex items-center justify-between overflow-hidden">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0 overflow-hidden">
                                        <div className="flex-shrink-0">
                                            <TaskPriorityIcon
                                                priority={
                                                    subtask.priority || 'low'
                                                }
                                                status={
                                                    subtask.status ||
                                                    'not_started'
                                                }
                                                onToggleCompletion={async () => {
                                                    if (
                                                        subtask.id &&
                                                        onSubtaskUpdate &&
                                                        !(
                                                            (subtask as any)
                                                                ._isNew ||
                                                            (subtask as any)
                                                                .isNew
                                                        )
                                                    ) {
                                                        // Existing subtask - use API for immediate toggle, then update callback
                                                        try {
                                                            const updatedSubtask =
                                                                await toggleTaskCompletion(
                                                                    subtask.uid!
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
                                                    } else {
                                                        // New subtask or no callback - handle locally
                                                        handleToggleNewSubtaskCompletion(
                                                            index
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>
                                        <span
                                            className={`text-sm flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 break-all ${
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
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white overflow-hidden"
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
