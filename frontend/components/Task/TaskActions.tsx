import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon } from '@heroicons/react/24/outline';

interface TaskActionsProps {
    taskId: number | undefined;
    onDelete: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const TaskActions: React.FC<TaskActionsProps> = ({
    taskId,
    onDelete,
    onSave,
    onCancel,
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-3 flex-shrink-0 flex justify-end space-x-2">
            {taskId && (
                <button
                    type="button"
                    onClick={onDelete}
                    className="p-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 flex items-center justify-center"
                    title={t('common.delete', 'Delete')}
                    aria-label={t('common.delete', 'Delete')}
                >
                    <TrashIcon className="h-5 w-5" />
                </button>
            )}
            <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
            >
                {t('common.cancel', 'Cancel')}
            </button>
            <button
                type="button"
                onClick={onSave}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-sm"
            >
                {t('common.save', 'Save')}
            </button>
        </div>
    );
};

export default TaskActions;
