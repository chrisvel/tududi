import React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, ArrowDownTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Template } from '../../entities/Template';
import { Task } from '../../entities/Task';

interface TemplatePreviewModalProps {
    template: Template;
    onClose: () => void;
    onClone: () => void;
}

const ACCENT_COLORS = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-teal-500',
];

function categoryAccentBar(category?: string | null) {
    if (!category) return 'bg-indigo-500';
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) & 0xffff;
    return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

const TaskTree: React.FC<{ task: Task }> = ({ task }) => {
    const subtasks = (task as any).subtasks || (task as any).Subtasks || [];
    return (
        <div>
            <div className="flex items-start gap-2.5 py-1.5">
                <CheckCircleIcon className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{task.name}</span>
                {(task as any).due_date && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto whitespace-nowrap">
                        {new Date((task as any).due_date).toLocaleDateString()}
                    </span>
                )}
            </div>
            {subtasks.length > 0 && (
                <div className="ml-6 pl-3 border-l-2 border-gray-100 dark:border-gray-700 mb-1">
                    {subtasks.map((sub: Task, i: number) => (
                        <div key={i} className="flex items-start gap-2 py-1">
                            <span className="text-gray-300 dark:text-gray-600 text-xs mt-px">—</span>
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
    const accentBar = categoryAccentBar(template.template_category);

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`h-1.5 w-full flex-shrink-0 ${accentBar}`} />

                <div className="px-6 pt-5 pb-4 flex-shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
                                {template.name}
                            </h3>
                            {template.template_category && (
                                <span className="inline-block mt-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                                    {template.template_category}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {template.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                            {template.description}
                        </p>
                    )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 mx-6" />

                <div className="px-6 py-3 flex-shrink-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {t('templates.taskList', 'Tasks')}
                        {tasks.length > 0 && <span className="ml-1.5 normal-case font-normal">({tasks.length})</span>}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
                    {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                            {t('templates.noTasks', 'No tasks in this template')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {tasks.map((task, i) => (
                                <TaskTree key={i} task={task} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-gray-50 dark:bg-gray-800/80">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        {tasks.length} {t('templates.tasks', 'tasks')}
                        {template.clone_count !== undefined && template.clone_count > 0 && (
                            <>
                                <span className="mx-2 text-gray-300 dark:text-gray-600">&bull;</span>
                                {template.clone_count} {t('templates.uses', 'uses')}
                            </>
                        )}
                    </span>
                    <button
                        onClick={onClone}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
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
