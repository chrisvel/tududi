import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PlayIcon,
    XMarkIcon,
    ArrowPathIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { FolderIcon } from '@heroicons/react/24/solid';
import { Task } from '../../entities/Task';
import { useToast } from '../Shared/ToastContext';

interface NextTaskSuggestionProps {
    metrics: {
        tasks_due_today: Task[];
        suggested_tasks: Task[];
        tasks_in_progress: Task[];
        today_plan_tasks?: Task[];
    };
    projects: any[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onClose?: () => void;
}

const NextTaskSuggestion: React.FC<NextTaskSuggestionProps> = ({
    metrics,
    projects,
    onTaskUpdate,
    onClose,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

    // Check if there are any tasks in progress
    // If there are tasks in progress, don't show the suggestion
    if (metrics.tasks_in_progress.length > 0) {
        return null;
    }

    // Helper function to check if task is not started
    const isNotStarted = (task: Task) => {
        return task.status === 'not_started' || task.status === 0;
    };

    // Get all available tasks in priority order:
    // 1. Today plan tasks (user's intentional selection for today)
    // 2. Due today tasks (time-based urgency)
    // 3. Suggested tasks from today page (algorithm recommendations)
    const todayPlanAvailable = (metrics.today_plan_tasks || []).filter(
        isNotStarted
    );
    const dueTodayAvailable = metrics.tasks_due_today.filter(isNotStarted);
    const suggestedAvailable = metrics.suggested_tasks.filter(isNotStarted);

    // Combine all available tasks with priority (intelligent selection)
    const allAvailableTasks = [
        ...todayPlanAvailable.map((task) => ({ task, source: 'today_plan' })),
        ...dueTodayAvailable.map((task) => ({ task, source: 'due_today' })),
        ...suggestedAvailable.map((task) => ({ task, source: 'suggested' })),
    ];

    if (allAvailableTasks.length === 0) {
        return null;
    }

    // Get current task based on index, wrap around if needed
    const currentTaskData =
        allAvailableTasks[currentTaskIndex % allAvailableTasks.length];
    const suggestedTask = currentTaskData.task;
    const suggestionSource = currentTaskData.source;

    // Helper function to get project name
    const getProjectName = (task: Task) => {
        if (task.Project) {
            return task.Project.name;
        }
        if (task.project_id) {
            const project = projects.find((p) => p.id === task.project_id);
            return project?.name;
        }
        return null;
    };

    const handleStartTask = async () => {
        if (!suggestedTask || !suggestedTask.id) return;

        setIsUpdating(true);
        try {
            // Universal rule: when setting status to in_progress, also add to today
            const updatedTask = {
                ...suggestedTask,
                status: 'in_progress' as const,
                today: true,
            };
            await onTaskUpdate(updatedTask);
            showSuccessToast(
                t('task.startedSuccessfully', 'Task started successfully!')
            );
        } catch (error) {
            console.error('Error starting task:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleGiveMeSomethingElse = () => {
        setCurrentTaskIndex((prev) => prev + 1);
    };

    return (
        <div className="mb-6 p-4 bg-white dark:bg-gray-900 border-l-4 border-purple-500 rounded-lg shadow relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label={t('common.close', 'Close')}
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            )}

            <div className="flex items-start">
                <SparklesIcon className="h-6 w-6 text-purple-500 dark:text-purple-400 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1 pr-8">
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-2 break-words">
                        {suggestionSource === 'today_plan' &&
                            t(
                                'nextTask.suggestionTodayPlan',
                                'Since there is nothing in progress, what about starting with this task from your today plan'
                            )}
                        {suggestionSource === 'due_today' &&
                            t(
                                'nextTask.suggestionDueToday',
                                'Since there is nothing in progress, what about starting with this task due today'
                            )}
                        {suggestionSource === 'suggested' &&
                            t(
                                'nextTask.suggestionSuggested',
                                'Since there is nothing in progress, what about starting with this suggested task'
                            )}
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 mb-3">
                        <p className="text-gray-900 dark:text-gray-100 font-medium break-words">
                            {suggestedTask.name}
                        </p>
                        {getProjectName(suggestedTask) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                                <FolderIcon className="h-3 w-3 mr-1" />
                                {getProjectName(suggestedTask)}
                            </p>
                        )}
                        {suggestedTask.due_date && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('forms.task.labels.dueDate', 'Due')}:{' '}
                                {new Date(
                                    suggestedTask.due_date
                                ).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                        <button
                            onClick={handleStartTask}
                            disabled={isUpdating}
                            className="flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-md transition-colors w-full sm:w-auto"
                        >
                            <PlayIcon className="h-4 w-4 mr-2" />
                            {isUpdating
                                ? t('nextTask.starting', 'Starting...')
                                : t('nextTask.letsDoIt', "Yes, let's do it!")}
                        </button>
                        {allAvailableTasks.length > 1 && (
                            <button
                                onClick={handleGiveMeSomethingElse}
                                disabled={isUpdating}
                                className="flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors w-full sm:w-auto"
                            >
                                <ArrowPathIcon className="h-4 w-4 mr-2" />
                                {t(
                                    'nextTask.giveMeSomethingElse',
                                    'Give me something else'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NextTaskSuggestion;
