import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { fetchSubtasks } from '../../../utils/tasksService';

interface SubtaskData {
    id?: number;
    name: string;
    isNew?: boolean;
    isEdited?: boolean;
}

interface TaskSubtasksSectionProps {
    parentTaskId: number;
    subtasks: SubtaskData[];
    onSubtasksChange: (subtasks: SubtaskData[]) => void;
    onSectionMount?: () => void;
}

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({
    parentTaskId,
    subtasks,
    onSubtasksChange,
    onSectionMount,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const { t } = useTranslation();
    const subtasksSectionRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    // Remove the automatic reloading when subtasks.length === 0
    // This was causing deleted subtasks to reappear
    // useEffect(() => {
    //     if (parentTaskId && subtasks.length === 0) {
    //         loadExistingSubtasks();
    //     }
    // }, [parentTaskId, subtasks.length]);

    useEffect(() => {
        // Scroll to bottom when section is mounted (opened)
        if (onSectionMount) {
            scrollToBottom();
            onSectionMount();
        }
    }, [onSectionMount]);

    const loadExistingSubtasks = async () => {
        try {
            setIsLoading(true);
            const existingSubtasks = await fetchSubtasks(parentTaskId);
            const subtaskData = existingSubtasks.map(task => ({
                id: task.id,
                name: task.name,
                isNew: false,
            }));
            onSubtasksChange(subtaskData);
        } catch {
            // Handle silently or show error if needed
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            if (subtasksSectionRef.current) {
                subtasksSectionRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'end' 
                });
            }
        }, 100);
    };

    const handleCreateSubtask = () => {
        if (!newSubtaskName.trim()) return;

        const newSubtask: SubtaskData = {
            name: newSubtaskName.trim(),
            isNew: true,
        };
        
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
                return {
                    ...subtask,
                    name: editingName.trim(),
                    isNew: subtask.isNew || false,
                    isEdited: !subtask.isNew && isNameChanged, // Mark as edited if it's existing and name changed
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

    const handleEditKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    return (
        <div ref={subtasksSectionRef} className="space-y-3">
            {/* Existing Subtasks */}
            {isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                <div className="space-y-2">
                    {subtasks.map((subtask, index) => (
                        <div
                            key={subtask.id || index}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
                        >
                            {editingIndex === index ? (
                                <div className="flex-1 flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyPress={handleEditKeyPress}
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
                                <span 
                                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1 hover:text-blue-600 dark:hover:text-blue-400"
                                    onClick={() => handleEditSubtask(index)}
                                    title={t('actions.clickToEdit', 'Click to edit')}
                                >
                                    {subtask.name}
                                    {subtask.isNew && (
                                        <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">
                                            (new)
                                        </span>
                                    )}
                                    {subtask.isEdited && (
                                        <span className="ml-2 text-xs text-orange-500 dark:text-orange-400">
                                            (edited)
                                        </span>
                                    )}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleDeleteSubtask(index)}
                                className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                title={t('actions.delete', 'Delete')}
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
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
                    onKeyPress={handleKeyPress}
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