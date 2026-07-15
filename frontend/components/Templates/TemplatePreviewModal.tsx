import React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Template } from '../../entities/Template';
import { Task } from '../../entities/Task';

interface TemplatePreviewModalProps {
    template: Template;
    onClose: () => void;
    onClone: () => void;
}

const TaskTree: React.FC<{ task: Task }> = ({ task }) => {
    const subtasks = (task as any).subtasks || (task as any).Subtasks || [];
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2 py-1">
                <ChevronRightIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{task.name}</span>
                {(task as any).due_date && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                        {new Date((task as any).due_date).toLocaleDateString()}
                    </span>
                )}
            </div>
            {subtasks.length > 0 && (
                <div className="pl-5 border-l border-gray-200 dark:border-gray-700 ml-1.5">
                    {subtasks.map((sub: Task, i: number) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{sub.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
    template,
    onClose,
    onClone,
}) => {
    const { t } = useTranslation();
    const tasks = template.Tasks || [];

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {template.name}
                        </h3>
                        {template.template_category && (
                            <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full mt-1 inline-block">
                                {template.template_category}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {template.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {template.description}
                    </p>
                )}

                <div className="flex-1 overflow-y-auto min-h-0">
                    {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                            {t('templates.noTasks', 'No tasks in this template')}
                        </p>
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                            {tasks.map((task, i) => (
                                <TaskTree key={i} task={task} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        {tasks.length} {t('templates.tasks', 'tasks')}
                        {template.clone_count !== undefined && template.clone_count > 0 && (
                            <span className="ml-2">&bull; {template.clone_count} {t('templates.uses', 'uses')}</span>
                        )}
                    </span>
                    <button
                        onClick={onClone}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        {t('templates.useTemplate', 'Use Template')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TemplatePreviewModal;
