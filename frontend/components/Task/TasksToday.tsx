import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { el, enUS, es, ja, uk, de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import {
    ClipboardDocumentListIcon,
    ArrowPathIcon,
    FolderIcon,
    CheckCircleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    Cog6ToothIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import {
    fetchTasks,
    updateTask,
    deleteTask,
    toggleTaskToday,
} from '../../utils/tasksService';
import { fetchProjects } from '../../utils/projectsService';
import { Task } from '../../entities/Task';
import { useStore } from '../../store/useStore';
import TaskList from './TaskList';
import TodayPlan from './TodayPlan';
import { Metrics } from '../../entities/Metrics';
import ProductivityAssistant from '../Productivity/ProductivityAssistant';
import NextTaskSuggestion from './NextTaskSuggestion';
import WeeklyCompletionChart from './WeeklyCompletionChart';
import TodaySettingsDropdown from './TodaySettingsDropdown';

const getLocale = (language: string) => {
    switch (language) {
        case 'el':
            return el;
        case 'es':
            return es;
        case 'jp':
            return ja;
        case 'ua':
            return uk;
        case 'de':
            return de;
        default:
            return enUS;
    }
};
const TasksToday: React.FC = () => {
    const { t } = useTranslation();

    // Get tasks from store at the top level to avoid conditional hook usage
    const storeTasks = useStore((state) => state.tasksStore.tasks);

    // Temporarily use local state to debug infinite loop

    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Keep local state for UI-specific data
    const [localProjects, setLocalProjects] = useState<any[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [dailyQuote, setDailyQuote] = useState<string>('');
    const [productivityAssistantEnabled, setProductivityAssistantEnabled] =
        useState(true);
    const [isSettingsEnabled, setIsSettingsEnabled] = useState(false);
    const [todaySettings, setTodaySettings] = useState({
        showMetrics: false,
        showProductivity: false,
        showNextTaskSuggestion: false,
        showSuggestions: false,
        showDueToday: true,
        showCompleted: true,
        showProgressBar: true, // Always enabled
        showDailyQuote: true,
    });
    const [nextTaskSuggestionEnabled, setNextTaskSuggestionEnabled] =
        useState(true);
    const [profileSettings, setProfileSettings] = useState({
        productivity_assistant_enabled: false,
        next_task_suggestion_enabled: false,
    });
    const [showNextTaskSuggestion, setShowNextTaskSuggestion] = useState(true);
    const [isSuggestedCollapsed, setIsSuggestedCollapsed] = useState(() => {
        const stored = localStorage.getItem('suggestedTasksCollapsed');
        return stored === 'true';
    });
    const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(() => {
        const stored = localStorage.getItem('completedTasksCollapsed');
        return stored === 'true';
    });
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Metrics from the API
    const [metrics, setMetrics] = useState<Metrics>({
        total_open_tasks: 0,
        tasks_pending_over_month: 0,
        tasks_in_progress_count: 0,
        tasks_in_progress: [],
        tasks_due_today: [],
        suggested_tasks: [],
        tasks_completed_today: [],
        weekly_completions: [],
    });

    // Helper function to get completion trend vs average
    const getCompletionTrend = () => {
        const todayCount = metrics.tasks_completed_today.length;

        // Calculate average: sum of all completed tasks divided by 7 days
        // The average represents the daily average across the week
        if (metrics.weekly_completions.length === 0) {
            return {
                direction: 'same',
                difference: 0,
                percentage: 0,
                todayCount,
                averageCount: 0,
            };
        }

        // Sum all completed tasks from the weekly data
        const totalCompletedTasks = metrics.weekly_completions.reduce(
            (sum, completion) => sum + completion.count,
            0
        );

        // Average is total completed tasks divided by 7
        const averageCount = totalCompletedTasks / 7;

        // Calculate percentage change vs average
        let percentage = 0;
        if (averageCount > 0) {
            percentage = Math.round(
                ((todayCount - averageCount) / averageCount) * 100
            );
        } else if (todayCount > 0) {
            // If average was 0 but today has completions, it's a 100%+ increase
            percentage = 100;
        }

        if (todayCount > averageCount) {
            return {
                direction: 'up',
                difference: Math.round((todayCount - averageCount) * 10) / 10, // Round to 1 decimal
                percentage: Math.abs(percentage),
                todayCount,
                averageCount: Math.round(averageCount * 10) / 10, // Round to 1 decimal
            };
        } else if (todayCount < averageCount) {
            return {
                direction: 'down',
                difference: Math.round((averageCount - todayCount) * 10) / 10, // Round to 1 decimal
                percentage: Math.abs(percentage),
                todayCount,
                averageCount: Math.round(averageCount * 10) / 10, // Round to 1 decimal
            };
        } else {
            return {
                direction: 'same',
                difference: 0,
                percentage: 0,
                todayCount,
                averageCount: Math.round(averageCount * 10) / 10, // Round to 1 decimal
            };
        }
    };

    // Track mounting state to prevent state updates after unmount
    const isMounted = React.useRef(false);

    // Function to handle next task suggestion dismissal
    const handleCloseNextTaskSuggestion = () => {
        setShowNextTaskSuggestion(false);
    };

    // Toggle functions for collapsible sections
    const toggleSuggestedCollapsed = () => {
        const newState = !isSuggestedCollapsed;
        setIsSuggestedCollapsed(newState);
        localStorage.setItem('suggestedTasksCollapsed', newState.toString());
    };

    const toggleCompletedCollapsed = () => {
        const newState = !isCompletedCollapsed;
        setIsCompletedCollapsed(newState);
        localStorage.setItem('completedTasksCollapsed', newState.toString());
    };

    // Load data once on component mount
    useEffect(() => {
        isMounted.current = true;

        // Only fetch data once on mount
        const loadData = async () => {
            if (!isMounted.current || hasInitialized || isLoading) {
                return;
            }

            setIsLoading(true);
            try {
                const { tasks: fetchedTasks, metrics: fetchedMetrics } =
                    await fetchTasks('?type=today');
                if (isMounted.current) {
                    // setTasks(fetchedTasks); // Removed local state
                    if (isMounted.current) {
                        // setTasks(fetchedTasks); // Removed local state
                        setMetrics(fetchedMetrics);
                        useStore.getState().tasksStore.setTasks(fetchedTasks);
                        setIsError(false);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                if (isMounted.current) {
                    setIsError(true);
                }
            }

            // Load all profile settings in a single API call instead of multiple calls
            try {
                const response = await fetch('/api/profile', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const userData = await response.json();
                    if (isMounted.current) {
                        // Set productivity assistant setting
                        setProductivityAssistantEnabled(
                            userData.productivity_assistant_enabled !==
                                undefined
                                ? userData.productivity_assistant_enabled
                                : true
                        );

                        // Set next task suggestion setting
                        setNextTaskSuggestionEnabled(
                            userData.next_task_suggestion_enabled !== undefined
                                ? userData.next_task_suggestion_enabled
                                : true
                        );

                        // Parse today_settings if it's a string, or use the object directly
                        let settings;
                        if (userData.today_settings) {
                            if (typeof userData.today_settings === 'string') {
                                try {
                                    settings = JSON.parse(
                                        userData.today_settings
                                    );
                                } catch (error) {
                                    console.error(
                                        'Error parsing today_settings:',
                                        error
                                    );
                                    settings = null;
                                }
                            } else {
                                settings = userData.today_settings;
                            }
                        }

                        // Use parsed settings or fall back to defaults
                        settings = settings || {
                            showMetrics: false,
                            showProductivity: false,
                            showNextTaskSuggestion: false,
                            showSuggestions: false,
                            showDueToday: true,
                            showCompleted: true,
                            showProgressBar: true, // Always enabled
                            showDailyQuote: true,
                        };

                        // Store profile settings
                        const currentProfileSettings = {
                            productivity_assistant_enabled:
                                userData.productivity_assistant_enabled ===
                                true,
                            next_task_suggestion_enabled:
                                userData.next_task_suggestion_enabled === true,
                        };
                        setProfileSettings(currentProfileSettings);

                        // Sync with profile AI & productivity features
                        if (
                            userData.productivity_assistant_enabled !==
                            undefined
                        ) {
                            settings.showProductivity =
                                userData.productivity_assistant_enabled;
                        }
                        if (
                            userData.next_task_suggestion_enabled !== undefined
                        ) {
                            settings.showNextTaskSuggestion =
                                userData.next_task_suggestion_enabled;
                        }

                        // Ensure progress bar is always enabled
                        settings.showProgressBar = true;

                        setTodaySettings(settings);
                        setIsSettingsLoaded(true);
                    }
                } else {
                    setIsSettingsLoaded(true);
                }
            } catch (error) {
                console.error('Failed to load profile settings:', error);
                // Set defaults on error
                if (isMounted.current) {
                    setProductivityAssistantEnabled(true);
                    setNextTaskSuggestionEnabled(true);
                    setIsSettingsLoaded(true);
                }
            }

            try {
                // Load projects first
                const projectsData = await fetchProjects();
                if (isMounted.current) {
                    const safeProjectsData = Array.isArray(projectsData)
                        ? projectsData
                        : [];
                    setLocalProjects(safeProjectsData);
                    useStore
                        .getState()
                        .projectsStore.setProjects(safeProjectsData);
                }
            } catch (error) {
                console.error('Projects loading error:', error);
                if (isMounted.current) {
                    setLocalProjects([]);
                    // Error handling is now managed by the store
                }
            }

            // Tasks will be loaded via the store's loadTasks method called earlier

            // Load daily quote from translations
            try {
                const response = await fetch(
                    `/locales/${i18n.language}/quotes.json`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (
                        isMounted.current &&
                        data.quotes &&
                        data.quotes.length > 0
                    ) {
                        // Get a random quote from the translated quotes
                        const randomIndex = Math.floor(
                            Math.random() * data.quotes.length
                        );
                        setDailyQuote(data.quotes[randomIndex]);
                    }
                } else {
                    // Fallback to English if language file doesn't exist
                    const fallbackResponse = await fetch(
                        '/locales/en/quotes.json'
                    );
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (
                            isMounted.current &&
                            fallbackData.quotes &&
                            fallbackData.quotes.length > 0
                        ) {
                            const randomIndex = Math.floor(
                                Math.random() * fallbackData.quotes.length
                            );
                            setDailyQuote(fallbackData.quotes[randomIndex]);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load daily quote:', error);
                // Ultimate fallback
                if (isMounted.current) {
                    setDailyQuote('Focus on progress, not perfection.');
                }
            }

            // Set loading to false and mark as initialized
            if (isMounted.current) {
                setIsInitialLoading(false);
                setIsLoading(false);
                setHasInitialized(true);
            }
        };

        loadData();

        // Cleanup function to prevent state updates after unmount
        return () => {
            isMounted.current = false;
        };
    }, []); // Empty dependency array - only run once on mount

    // Memoize task handlers to prevent recreating functions on each render
    const handleTaskUpdate = useCallback(
        async (updatedTask: Task): Promise<void> => {
            if (!updatedTask.id || !isMounted.current) return;

            // Optimistically update UI
            setMetrics((prevMetrics) => {
                const newMetrics = { ...prevMetrics };

                // Helper to remove task from a list
                const removeTask = (list: Task[]) =>
                    list.filter((task) => task.id !== updatedTask.id);

                // Helper to add or update task in a list
                const updateOrAddTask = (list: Task[], taskToProcess: Task) => {
                    const existingIndex = list.findIndex(
                        (task) => task.id === taskToProcess.id
                    );
                    if (existingIndex > -1) {
                        // Task exists, update it by creating a new object and a new array
                        // Preserve subtasks data to prevent loss
                        return list.map((task, index) =>
                            index === existingIndex
                                ? {
                                      ...task,
                                      ...taskToProcess,
                                      // Explicitly preserve subtasks data
                                      subtasks:
                                          taskToProcess.subtasks ||
                                          taskToProcess.Subtasks ||
                                          task.subtasks ||
                                          task.Subtasks ||
                                          [],
                                      Subtasks:
                                          taskToProcess.subtasks ||
                                          taskToProcess.Subtasks ||
                                          task.subtasks ||
                                          task.Subtasks ||
                                          [],
                                  }
                                : task
                        );
                    } else {
                        // Task does not exist, add it by creating a new array
                        return [...list, taskToProcess];
                    }
                };

                // Remove task from all potential "active" lists first
                newMetrics.today_plan_tasks = removeTask(
                    newMetrics.today_plan_tasks || []
                );
                newMetrics.suggested_tasks = removeTask(
                    newMetrics.suggested_tasks || []
                );
                newMetrics.tasks_due_today = removeTask(
                    newMetrics.tasks_due_today || []
                );
                newMetrics.tasks_in_progress = removeTask(
                    newMetrics.tasks_in_progress || []
                );
                newMetrics.tasks_completed_today = removeTask(
                    newMetrics.tasks_completed_today || []
                ); // Always remove from completed first

                // Now, add the task to the appropriate list(s) based on its new status
                if (updatedTask.status === 'done' || updatedTask.status === 2) {
                    // If completed, add to tasks_completed_today if it was completed today
                    if (updatedTask.completed_at) {
                        const completedDate = new Date(
                            updatedTask.completed_at
                        );
                        const today = new Date();
                        if (
                            format(completedDate, 'yyyy-MM-dd') ===
                            format(today, 'yyyy-MM-dd')
                        ) {
                            newMetrics.tasks_completed_today = updateOrAddTask(
                                newMetrics.tasks_completed_today,
                                updatedTask
                            );
                        }
                    }
                } else {
                    // If not completed, add to relevant active lists
                    if (
                        updatedTask.today &&
                        updatedTask.status !== 'archived'
                    ) {
                        newMetrics.today_plan_tasks = updateOrAddTask(
                            newMetrics.today_plan_tasks,
                            updatedTask
                        );
                    }
                    if (updatedTask.status === 'in_progress') {
                        newMetrics.tasks_in_progress = updateOrAddTask(
                            newMetrics.tasks_in_progress,
                            updatedTask
                        );
                    }
                    // Check if due today (and not already in today_plan_tasks or in_progress)
                    const isDueToday =
                        updatedTask.due_date &&
                        format(new Date(updatedTask.due_date), 'yyyy-MM-dd') ===
                            format(new Date(), 'yyyy-MM-dd');
                    if (
                        isDueToday &&
                        updatedTask.status !== 'archived' &&
                        !newMetrics.today_plan_tasks.some(
                            (t) => t.id === updatedTask.id
                        ) &&
                        !newMetrics.tasks_in_progress.some(
                            (t) => t.id === updatedTask.id
                        )
                    ) {
                        newMetrics.tasks_due_today = updateOrAddTask(
                            newMetrics.tasks_due_today,
                            updatedTask
                        );
                    }
                    // Check for suggested tasks (and not already in other active lists)
                    const isSuggested =
                        !updatedTask.today &&
                        !updatedTask.project_id &&
                        !updatedTask.due_date;
                    // Check if task is not completed (can be string or number)
                    const taskStatus = updatedTask.status as string | number;
                    const isNotCompleted =
                        taskStatus !== 'archived' &&
                        taskStatus !== 'done' &&
                        taskStatus !== 2 &&
                        taskStatus !== 3;

                    if (
                        isSuggested &&
                        isNotCompleted &&
                        !newMetrics.today_plan_tasks.some(
                            (t) => t.id === updatedTask.id
                        ) &&
                        !newMetrics.tasks_due_today.some(
                            (t) => t.id === updatedTask.id
                        ) &&
                        !newMetrics.tasks_in_progress.some(
                            (t) => t.id === updatedTask.id
                        )
                    ) {
                        newMetrics.suggested_tasks = updateOrAddTask(
                            newMetrics.suggested_tasks,
                            updatedTask
                        );
                    }
                }

                // Recalculate total_open_tasks based on the updated active lists
                newMetrics.total_open_tasks =
                    newMetrics.today_plan_tasks.length +
                    newMetrics.suggested_tasks.length +
                    newMetrics.tasks_due_today.length +
                    newMetrics.tasks_in_progress.length;

                return newMetrics;
            });

            // Update the store with the updated task
            useStore.getState().tasksStore.updateTaskInStore(updatedTask);

            try {
                // Make API call to persist the change
                await updateTask(updatedTask.id, updatedTask);
            } catch (error) {
                console.error('Error updating task:', error);
                // Revert UI on error if necessary, or re-fetch to sync
                // For now, just log the error
            }
        },
        [] // Dependencies are now handled by direct state manipulation
    );

    const handleTaskDelete = useCallback(
        async (taskId: number): Promise<void> => {
            if (!isMounted.current) return;

            try {
                await deleteTask(taskId);

                // Reload tasks to reflect the change
                const { tasks: updatedTasks, metrics: updatedMetrics } =
                    await fetchTasks('?type=today');
                if (isMounted.current) {
                    useStore.getState().tasksStore.setTasks(updatedTasks);
                    setMetrics(updatedMetrics);
                }
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        },
        []
    );

    const handleToggleToday = useCallback(
        async (taskId: number): Promise<void> => {
            if (!isMounted.current) return;

            try {
                await toggleTaskToday(taskId);

                // Reload tasks to reflect the change
                const { tasks: updatedTasks, metrics: updatedMetrics } =
                    await fetchTasks('?type=today');
                if (isMounted.current) {
                    useStore.getState().tasksStore.setTasks(updatedTasks);
                    setMetrics(updatedMetrics);
                }
            } catch (error) {
                console.error('Error toggling task today status:', error);
            }
        },
        []
    );

    const handleTaskCompletionToggle = useCallback(
        async (updatedTask: Task): Promise<void> => {
            if (!isMounted.current) return;

            try {
                // The updatedTask is already the result of the API call from TaskItem
                // Use the centralized task update handler to update UI optimistically
                await handleTaskUpdate(updatedTask);
            } catch (error) {
                console.error('Error toggling task completion:', error);
            }
        },
        [handleTaskUpdate]
    );

    // Calculate today's progress for the progress bar
    const getTodayProgress = () => {
        const todayTasks = metrics.today_plan_tasks || [];
        const completedToday = metrics.tasks_completed_today.length;
        const totalTodayTasks = todayTasks.length + completedToday;

        return {
            completed: completedToday,
            total: totalTodayTasks,
            percentage:
                totalTodayTasks === 0
                    ? 0
                    : Math.round((completedToday / totalTodayTasks) * 100),
        };
    };

    const todayProgress = getTodayProgress();

    // Handle settings change
    const handleSettingsChange = (newSettings: typeof todaySettings) => {
        setTodaySettings(newSettings);
    };

    // Show loading state until both data and settings are loaded (only for initial load)
    if (isInitialLoading || !isSettingsLoaded) {
        return (
            <div className="flex justify-center items-center h-64">
                <p className="text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </p>
            </div>
        );
    }

    // Show error state
    if (isError && storeTasks.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <p className="text-red-500">
                    {t('errors.somethingWentWrong', 'Something went wrong')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                <div className="flex flex-col">
                    {/* Today Header with Icons on the Right */}
                    <div className="mb-4">
                        <div className="flex items-end justify-between mb-4">
                            <div className="flex items-end">
                                <h2 className="text-2xl font-light mr-2">
                                    {t('tasks.today')},
                                </h2>
                                <span className="text-lg font-light text-gray-500 dark:text-gray-400 opacity-80">
                                    {format(new Date(), 'PPP', {
                                        locale: getLocale(i18n.language),
                                    })}
                                </span>
                            </div>

                            {/* Today Navigation Icons */}
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <button
                                        onClick={() =>
                                            setIsSettingsEnabled(
                                                !isSettingsEnabled
                                            )
                                        }
                                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800${
                                            isSettingsEnabled
                                                ? ' bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                : ' text-gray-600 dark:text-gray-400'
                                        }`}
                                        title={t(
                                            'settings.todayPageSettings',
                                            'Today Page Settings'
                                        )}
                                    >
                                        <Cog6ToothIcon className="h-5 w-5" />
                                    </button>

                                    <TodaySettingsDropdown
                                        isOpen={isSettingsEnabled}
                                        onClose={() =>
                                            setIsSettingsEnabled(false)
                                        }
                                        settings={todaySettings}
                                        profileSettings={profileSettings}
                                        onSettingsChange={handleSettingsChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Today Progress Bar and Daily Quote */}
                        <div className="mb-1">
                            {/* Progress Bar - always show when setting is enabled */}
                            {todaySettings.showProgressBar && (
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-2">
                                    <div
                                        className="h-1 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-400 via-blue-500 to-blue-700"
                                        style={{
                                            width: `${todayProgress.percentage}%`,
                                        }}
                                    ></div>
                                </div>
                            )}

                            {/* Daily Quote - show independently of progress bar */}
                            {todaySettings.showDailyQuote && dailyQuote && (
                                <div className="mt-2">
                                    <p className="text-s text-gray-400 dark:text-gray-500 font-light text-left">
                                        {dailyQuote}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Metrics Section - Always reserve space to prevent layout shift */}
                {!isSettingsLoaded ? (
                    // Invisible placeholder that reserves the exact same space
                    <div
                        className="mb-2 opacity-0 pointer-events-none"
                        aria-hidden="true"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-32"></div>
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-32"></div>
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-32"></div>
                        </div>
                    </div>
                ) : todaySettings.showMetrics ? (
                    <div className="mb-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Combined Task & Project Metrics */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                {t('dashboard.overview')}
                            </h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <ClipboardDocumentListIcon className="h-4 w-4 text-blue-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.backlog')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold">
                                        {metrics.total_open_tasks}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <ArrowPathIcon className="h-4 w-4 text-green-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.inProgress')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold">
                                        {metrics.tasks_in_progress_count}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CalendarDaysIcon className="h-4 w-4 text-red-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.dueToday')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold">
                                        {metrics.tasks_due_today.length}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'tasks.completedToday',
                                                'Completed Today'
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        {(() => {
                                            const trend = getCompletionTrend();
                                            const getTooltipText = () => {
                                                if (
                                                    trend.direction === 'same'
                                                ) {
                                                    return t(
                                                        'dashboard.sameAsAverage',
                                                        'Same as average'
                                                    );
                                                } else if (
                                                    trend.direction === 'up'
                                                ) {
                                                    return t(
                                                        'dashboard.betterThanAverage',
                                                        '{{percentage}}% more than average',
                                                        {
                                                            percentage:
                                                                trend.percentage,
                                                        }
                                                    );
                                                } else {
                                                    return t(
                                                        'dashboard.worseThanAverage',
                                                        '{{percentage}}% less than average',
                                                        {
                                                            percentage:
                                                                trend.percentage,
                                                        }
                                                    );
                                                }
                                            };

                                            return (
                                                <>
                                                    {(trend.direction ===
                                                        'up' ||
                                                        trend.direction ===
                                                            'down') && (
                                                        <div className="relative group">
                                                            {trend.direction ===
                                                                'up' && (
                                                                <ArrowUpIcon className="h-3 w-3 text-green-500" />
                                                            )}
                                                            {trend.direction ===
                                                                'down' && (
                                                                <ArrowDownIcon className="h-3 w-3 text-red-500" />
                                                            )}
                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                                                {getTooltipText()}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <p className="text-sm font-semibold">
                                                        {
                                                            metrics
                                                                .tasks_completed_today
                                                                .length
                                                        }
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <FolderIcon className="h-4 w-4 text-purple-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('projects.active')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold">
                                        {Array.isArray(localProjects)
                                            ? localProjects.filter(
                                                  (project) => project.active
                                              ).length
                                            : 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Completion Chart */}
                        <div className="lg:col-span-2">
                            <WeeklyCompletionChart
                                data={metrics.weekly_completions}
                            />
                        </div>
                    </div>
                ) : null}

                {/* Productivity Assistant - Conditionally Rendered */}
                {!isSettingsLoaded ? (
                    // Invisible placeholder for productivity assistant
                    <div
                        className="mb-4 opacity-0 pointer-events-none"
                        aria-hidden="true"
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-24"></div>
                    </div>
                ) : todaySettings.showProductivity &&
                  productivityAssistantEnabled &&
                  profileSettings.productivity_assistant_enabled === true ? (
                    <ProductivityAssistant
                        tasks={storeTasks}
                        projects={localProjects}
                    />
                ) : null}

                {/* Next Task Suggestion - At top of tasks section */}
                {!isSettingsLoaded ? (
                    // Invisible placeholder for next task suggestion
                    <div
                        className="mb-4 opacity-0 pointer-events-none"
                        aria-hidden="true"
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-20"></div>
                    </div>
                ) : todaySettings.showNextTaskSuggestion &&
                  nextTaskSuggestionEnabled &&
                  showNextTaskSuggestion &&
                  profileSettings.next_task_suggestion_enabled === true ? (
                    <div className="mb-4">
                        <NextTaskSuggestion
                            metrics={{
                                tasks_due_today: metrics.tasks_due_today,
                                suggested_tasks: metrics.suggested_tasks,
                                tasks_in_progress: metrics.tasks_in_progress,
                                today_plan_tasks: metrics.today_plan_tasks,
                            }}
                            projects={localProjects}
                            onTaskUpdate={handleTaskUpdate}
                            onClose={handleCloseNextTaskSuggestion}
                        />
                    </div>
                ) : null}

                {/* Today Plan */}
                <TodayPlan
                    todayPlanTasks={metrics.today_plan_tasks || []}
                    projects={localProjects}
                    onTaskUpdate={handleTaskUpdate}
                    onTaskDelete={handleTaskDelete}
                    onToggleToday={handleToggleToday}
                    onTaskCompletionToggle={handleTaskCompletionToggle}
                />

                {/* Suggested Tasks - Separate setting */}
                {!isSettingsLoaded ? (
                    // Invisible placeholder for suggestions
                    <div
                        className="mt-2 opacity-0 pointer-events-none"
                        aria-hidden="true"
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-20"></div>
                    </div>
                ) : todaySettings.showSuggestions &&
                  metrics.suggested_tasks.length > 0 ? (
                    <div className="mt-2 mb-6">
                        <div
                            className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                            onClick={toggleSuggestedCollapsed}
                        >
                            <h3 className="text-xl font-medium">
                                {t('tasks.suggested')}
                            </h3>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-2">
                                    {metrics.suggested_tasks.length}
                                </span>
                                {isSuggestedCollapsed ? (
                                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                        </div>
                        {!isSuggestedCollapsed && (
                            <TaskList
                                tasks={metrics.suggested_tasks}
                                onTaskUpdate={handleTaskUpdate}
                                onTaskCompletionToggle={
                                    handleTaskCompletionToggle
                                }
                                onTaskDelete={handleTaskDelete}
                                projects={localProjects}
                                onToggleToday={handleToggleToday}
                            />
                        )}
                    </div>
                ) : null}

                {/* Due Today Tasks - Conditionally Rendered */}
                {isSettingsLoaded &&
                    todaySettings.showDueToday &&
                    metrics.tasks_due_today.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xl font-medium mt-6 mb-2">
                                {t('tasks.dueToday')}
                            </h3>
                            <TaskList
                                tasks={metrics.tasks_due_today}
                                onTaskUpdate={handleTaskUpdate}
                                onTaskDelete={handleTaskDelete}
                                projects={localProjects}
                                onToggleToday={handleToggleToday}
                                onTaskCompletionToggle={
                                    handleTaskCompletionToggle
                                }
                            />
                        </div>
                    )}

                {/* Completed Tasks - Conditionally Rendered */}
                {isSettingsLoaded &&
                    todaySettings.showCompleted &&
                    (() => {
                        const completedToday = metrics.tasks_completed_today; // Use the already filtered list from backend
                        return (
                            <div className="mb-6">
                                <div
                                    className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                                    onClick={toggleCompletedCollapsed}
                                >
                                    <h3 className="text-xl font-medium">
                                        {t('tasks.completedToday')}
                                    </h3>
                                    <div className="flex items-center">
                                        <span className="text-sm text-gray-500 mr-2">
                                            {completedToday.length}
                                        </span>
                                        {isCompletedCollapsed ? (
                                            <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                        ) : (
                                            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                        )}
                                    </div>
                                </div>
                                {!isCompletedCollapsed &&
                                    (completedToday.length > 0 ? (
                                        <TaskList
                                            tasks={completedToday}
                                            onTaskUpdate={handleTaskUpdate}
                                            onTaskDelete={handleTaskDelete}
                                            projects={localProjects}
                                            onToggleToday={handleToggleToday}
                                            showCompletedTasks={true}
                                        />
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
                                            {t(
                                                'tasks.noCompletedTasksToday',
                                                'No completed tasks today.'
                                            )}
                                        </p>
                                    ))}
                            </div>
                        );
                    })()}

                {metrics.tasks_due_today.length === 0 &&
                    metrics.tasks_in_progress.length === 0 &&
                    metrics.suggested_tasks.length === 0 &&
                    (metrics.today_plan_tasks || []).length > 0 && (
                        <p className="text-gray-500 text-center mt-4">
                            {t('tasks.noTasksAvailable')}
                        </p>
                    )}
            </div>
        </div>
    );
};

export default TasksToday;
