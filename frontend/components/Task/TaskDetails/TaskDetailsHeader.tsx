import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import TaskPriorityIcon from '../TaskPriorityIcon';
import { Task } from '../../../entities/Task';

interface TaskDetailsHeaderProps {
    task: Task;
    onToggleCompletion: () => void;
    onTitleUpdate: (newTitle: string) => Promise<void>;
    onEdit: () => void;
    onDelete: () => void;
}

const TaskDetailsHeader: React.FC<TaskDetailsHeaderProps> = ({
    task,
    onToggleCompletion,
    onTitleUpdate,
    onEdit,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.name);
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditedTitle(task.name);
    }, [task.name]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                actionsMenuOpen &&
                actionsMenuRef.current &&
                !actionsMenuRef.current.contains(e.target as Node)
            ) {
                setActionsMenuOpen(false);
            }
        };

        if (actionsMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [actionsMenuOpen]);

    const handleStartTitleEdit = () => {
        setIsEditingTitle(true);
    };

    const handleSaveTitle = async () => {
        if (editedTitle.trim() && editedTitle !== task.name) {
            await onTitleUpdate(editedTitle.trim());
        }
        setIsEditingTitle(false);
    };

    const handleCancelTitleEdit = () => {
        setEditedTitle(task.name);
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            handleCancelTitleEdit();
        }
    };

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <TaskPriorityIcon
                    priority={task.priority}
                    status={task.status}
                    onToggleCompletion={onToggleCompletion}
                />
                <div className="flex flex-col flex-1">
                    {isEditingTitle ? (
                        <div className="flex items-center space-x-2">
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                onBlur={handleSaveTitle}
                                className="text-2xl font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                                placeholder={t(
                                    'task.titlePlaceholder',
                                    'Enter task title'
                                )}
                            />
                            <button
                                onClick={handleSaveTitle}
                                className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 rounded-full transition-colors duration-200"
                                title={t('common.save', 'Save')}
                            >
                                <CheckIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleCancelTitleEdit}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full transition-colors duration-200"
                                title={t('common.cancel', 'Cancel')}
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <h2
                            onClick={handleStartTitleEdit}
                            className="text-2xl font-normal text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 transition-colors"
                            title={t(
                                'task.clickToEditTitle',
                                'Click to edit title'
                            )}
                        >
                            {task.name}
                        </h2>
                    )}
                </div>
            </div>
            <div className="relative" ref={actionsMenuRef}>
                <button
                    className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded transition-colors duration-200 text-base"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActionsMenuOpen(!actionsMenuOpen);
                    }}
                    aria-haspopup="true"
                    aria-expanded={actionsMenuOpen}
                    aria-label={t('common.moreActions', 'More actions')}
                >
                    ...
                </button>
                {actionsMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActionsMenuOpen(false);
                                onEdit();
                            }}
                        >
                            {t('common.edit', 'Edit')}
                        </button>
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-b-lg"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActionsMenuOpen(false);
                                onDelete();
                            }}
                        >
                            {t('common.delete', 'Delete')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskDetailsHeader;
