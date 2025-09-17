import React from 'react';
import { useTranslation } from 'react-i18next';

interface TaskAnalysis {
    isVague: boolean;
    severity: 'low' | 'medium' | 'high';
    reason: string;
    suggestion?: string;
}

interface TaskTitleSectionProps {
    taskId: number | undefined;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    taskAnalysis: TaskAnalysis | null;
    taskIntelligenceEnabled: boolean;
    onSubmit?: () => void;
}

const TaskTitleSection: React.FC<TaskTitleSectionProps> = ({
    taskId,
    value,
    onChange,
    taskAnalysis,
    taskIntelligenceEnabled,
    onSubmit,
}) => {
    const { t } = useTranslation();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Handle Enter key to save changes
        if (e.key === 'Enter') {
            e.preventDefault();
            if (onSubmit) {
                onSubmit();
            }
        }
    };

    return (
        <div className="px-4 py-4">
            <input
                type="text"
                id={`task_name_${taskId}`}
                name="name"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                required
                className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-none focus:outline-none focus:border-none focus:ring-0 py-2"
                placeholder={t('forms.task.namePlaceholder', 'Add Task Name')}
                data-testid="task-name-input"
            />
            {taskAnalysis &&
                taskAnalysis.isVague &&
                taskIntelligenceEnabled && (
                    <div
                        className={`mt-2 p-3 rounded-md border ${
                            taskAnalysis.severity === 'high'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                                : taskAnalysis.severity === 'medium'
                                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                        }`}
                    >
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg
                                    className={`h-4 w-4 mt-0.5 ${
                                        taskAnalysis.severity === 'high'
                                            ? 'text-red-400'
                                            : taskAnalysis.severity === 'medium'
                                              ? 'text-yellow-400'
                                              : 'text-blue-400'
                                    }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="ml-2">
                                <p
                                    className={`text-sm ${
                                        taskAnalysis.severity === 'high'
                                            ? 'text-red-800 dark:text-red-200'
                                            : taskAnalysis.severity === 'medium'
                                              ? 'text-yellow-800 dark:text-yellow-200'
                                              : 'text-blue-800 dark:text-blue-200'
                                    }`}
                                >
                                    <strong>
                                        {taskAnalysis.reason === 'short' &&
                                            t(
                                                'task.nameHelper.short',
                                                'Make it more descriptive!'
                                            )}
                                        {taskAnalysis.reason === 'no_verb' &&
                                            t(
                                                'task.nameHelper.noVerb',
                                                'Add an action verb!'
                                            )}
                                        {taskAnalysis.reason ===
                                            'vague_pattern' &&
                                            t(
                                                'task.nameHelper.vague',
                                                'Be more specific!'
                                            )}
                                    </strong>
                                </p>
                                {taskAnalysis.suggestion && (
                                    <p
                                        className={`text-xs mt-1 ${
                                            taskAnalysis.severity === 'high'
                                                ? 'text-red-700 dark:text-red-300'
                                                : taskAnalysis.severity ===
                                                    'medium'
                                                  ? 'text-yellow-700 dark:text-yellow-300'
                                                  : 'text-blue-700 dark:text-blue-300'
                                        }`}
                                    >
                                        {t(
                                            taskAnalysis.suggestion,
                                            taskAnalysis.suggestion
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default TaskTitleSection;
