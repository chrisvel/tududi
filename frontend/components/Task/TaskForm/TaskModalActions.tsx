import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface TaskModalActionsProps {
    taskId?: number;
    isSaving: boolean;
    onDelete: () => void;
    onCancel: () => void;
    onSave: () => void;
}

const TaskModalActions: React.FC<TaskModalActionsProps> = ({
    taskId,
    isSaving,
    onDelete,
    onCancel,
    onSave,
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-bl-lg">
            {/* Left side: Delete and Cancel */}
            <div className="flex items-center space-x-3">
                {taskId && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                        title={t('common.delete', 'Delete')}
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                >
                    {t('common.cancel', 'Cancel')}
                </button>
            </div>

            {/* Right side: Save */}
            <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`px-4 py-2 rounded-md focus:outline-none transition duration-150 ease-in-out text-sm ${
                    isSaving
                        ? 'bg-blue-400 text-white cursor-not-allowed dark:bg-blue-400'
                        : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                }`}
                data-testid="task-save-button"
            >
                {isSaving ? (
                    <span className="flex items-center">
                        <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        {t('common.saving', 'Saving...')}
                    </span>
                ) : (
                    t('common.save', 'Save')
                )}
            </button>
        </div>
    );
};

export default TaskModalActions;
