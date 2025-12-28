import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { el, enUS, es, ja, uk, de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { useNavigate } from 'react-router-dom';
import { getLocalesPath, getApiPath } from '../../config/paths';
import { sortTasksByPriorityDueDateProject } from '../../utils/taskSortUtils';
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
    QueueListIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks, updateTask, deleteTask } from '../../utils/tasksService';
import {
    isTaskDone,
    isTaskActive,
    isHabitArchived,
    isTaskInProgress,
    isTaskPlanned,
    isTaskWaiting,
} from '../../constants/taskStatus';
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

const filterNonHabitTasks = (tasks: Task[] = []) =>
    tasks.filter((task) => !task.habit_mode);

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
    const navigate = useNavigate();

    // Get tasks from store at the top level to avoid conditional hook usage
    const storeTasks = useStore((state) => state.tasksStore.tasks);
    const tagsStore = useStore((state) => state.tagsStore);
    const todayHabits = useStore((state) => state.habitsStore.habits);
    const loadHabitsStore = useStore((state) => state.habitsStore.loadHabits);
    const logHabitCompletion = useStore(
        (state) => state.habitsStore.logCompletion
    );
    const removeHabitCompletion = useStore(
        (state) => state.habitsStore.removeTodayCompletion
    );

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
    const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(() => {
        const stored = localStorage.getItem('overdueTasksCollapsed');
        return stored === 'true';
    });
    const [isTodayPlanCollapsed, setIsTodayPlanCollapsed] = useState(() => {
        const stored = localStorage.getItem('todayPlanTasksCollapsed');
        return stored === 'true';
    });
    const [isDueTodayCollapsed, setIsDueTodayCollapsed] = useState(() => {
        const stored = localStorage.getItem('dueTodayTasksCollapsed');
        return stored === 'true';
    });
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Metrics from the API (counts) + task arrays stored locally
    const [metrics, setMetrics] = useState<
        Metrics & {
            tasks_in_progress?: Task[];
            tasks_due_today?: Task[];
            tasks_overdue?: Task[];
            today_plan_tasks?: Task[];
            suggested_tasks?: Task[];
            tasks_completed_today?: Task[];
        }
    >({
        total_open_tasks: 0,
        tasks_pending_over_month: 0,
        tasks_in_progress_count: 0,
        tasks_due_today_count: 0,
        today_plan_tasks_count: 0,
        suggested_tasks_count: 0,
        tasks_completed_today_count: 0,
        weekly_completions: [],
        // Task arrays (fetched separately via include_lists parameter)
        tasks_in_progress: [],
        tasks_due_today: [],
        tasks_overdue: [],
        today_plan_tasks: [],
        suggested_tasks: [],
        tasks_completed_today: [],
    });

    // Client-side pagination for Due Today tasks (since backend returns all)
    const [dueTodayDisplayLimit, setDueTodayDisplayLimit] = useState(20);

    // Client-side pagination for Planned tasks (since backend returns all)
    const [plannedDisplayLimit, setPlannedDisplayLimit] = useState(20);

    // Client-side pagination for Overdue tasks (since backend returns all)
    const [overdueDisplayLimit, setOverdueDisplayLimit] = useState(20);

    // Client-side pagination for Suggested tasks
    const [suggestedDisplayLimit, setSuggestedDisplayLimit] = useState(20);

    // Client-side pagination for Completed Today tasks (since backend returns all)
    const [completedTodayDisplayLimit, setCompletedTodayDisplayLimit] =
        useState(20);
    const [habitActionUid, setHabitActionUid] = useState<string | null>(null);

    // Helper to get current task data from global store
    // Metrics provides section membership (task IDs), store provides current data
    const getTasksFromStore = useCallback(
        (metricsTasks: Task[]) => {
            const taskIds = new Set(metricsTasks.map((t) => t.id));
            return storeTasks.filter((t: Task) => taskIds.has(t.id));
        },
        [storeTasks]
    );

    const plannedTasks = useMemo(() => {
        // Get current task data from store, filtered by section membership from metrics
        const tasks = getTasksFromStore(metrics.today_plan_tasks || []);
        return filterNonHabitTasks(tasks);
    }, [metrics.today_plan_tasks, getTasksFromStore]);

    const completedTasksList = useMemo(() => {
        const tasks = getTasksFromStore(metrics.tasks_completed_today || []);
        return filterNonHabitTasks(tasks);
    }, [metrics.tasks_completed_today, getTasksFromStore]);

    // Sort tasks using multi-criteria sorting (Priority → Due Date → Project) for consistency
    // Task data comes from global store so priority changes are immediately reflected
    const sortedSuggestedTasks = useMemo(() => {
        const tasks = getTasksFromStore(metrics.suggested_tasks || []);
        return sortTasksByPriorityDueDateProject(tasks);
    }, [metrics.suggested_tasks, getTasksFromStore]);

    const sortedDueTodayTasks = useMemo(() => {
        const tasks = getTasksFromStore(metrics.tasks_due_today || []);
        return sortTasksByPriorityDueDateProject(tasks);
    }, [metrics.tasks_due_today, getTasksFromStore]);

    const sortedOverdueTasks = useMemo(() => {
        const tasks = getTasksFromStore(metrics.tasks_overdue || []);
        return sortTasksByPriorityDueDateProject(tasks);
    }, [metrics.tasks_overdue, getTasksFromStore]);

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

    const toggleOverdueCollapsed = () => {
        const newState = !isOverdueCollapsed;
        setIsOverdueCollapsed(newState);
        localStorage.setItem('overdueTasksCollapsed', newState.toString());
    };

    const toggleTodayPlanCollapsed = () => {
        const newState = !isTodayPlanCollapsed;
        setIsTodayPlanCollapsed(newState);
        localStorage.setItem('todayPlanTasksCollapsed', newState.toString());
    };

    const toggleDueTodayCollapsed = () => {
        const newState = !isDueTodayCollapsed;
        setIsDueTodayCollapsed(newState);
        localStorage.setItem('dueTodayTasksCollapsed', newState.toString());
    };

    const isHabitCompletedToday = useCallback((habit: Task) => {
        if (!habit.habit_last_completion_at) {
            return false;
        }
        const completionDate = new Date(habit.habit_last_completion_at);
        const today = new Date();
        return (
            completionDate.getFullYear() === today.getFullYear() &&
            completionDate.getMonth() === today.getMonth() &&
            completionDate.getDate() === today.getDate()
        );
    }, []);

    const plannedHabits = useMemo(
        () =>
            todayHabits.filter(
                (habit) =>
                    !isHabitArchived(habit.status) &&
                    !isHabitCompletedToday(habit)
            ),
        [todayHabits, isHabitCompletedToday]
    );

    const completedHabits = useMemo(
        () =>
            todayHabits.filter(
                (habit) =>
                    !isHabitArchived(habit.status) &&
                    isHabitCompletedToday(habit)
            ),
        [todayHabits, isHabitCompletedToday]
    );

    const getHabitPeriodLabel = useCallback(
        (period?: string) => {
            switch (period) {
                case 'weekly':
                    return t('habits.week', 'Week').toLowerCase();
                case 'monthly':
                    return t('habits.month', 'Month').toLowerCase();
                default:
                    return t('habits.day', 'Day').toLowerCase();
            }
        },
        [t]
    );

    const handleHabitToggle = useCallback(
        async (habit: Task) => {
            if (!habit.uid || habitActionUid) return;
            setHabitActionUid(habit.uid);
            try {
                if (isHabitCompletedToday(habit)) {
                    await removeHabitCompletion(habit.uid);
                } else {
                    await logHabitCompletion(habit.uid);
                }
            } catch (error) {
                console.error('Failed to toggle habit completion:', error);
            } finally {
                setHabitActionUid(null);
            }
        },
        [
            habitActionUid,
            isHabitCompletedToday,
            logHabitCompletion,
            removeHabitCompletion,
        ]
    );

    const handleHabitDetails = useCallback(
        (habit: Task) => {
            if (!habit.uid) return;
            navigate(`/habit/${habit.uid}`);
        },
        [navigate]
    );

    const renderHabitList = useCallback(
        (habitsList: Task[], variant: 'planned' | 'completed') => {
            if (habitsList.length === 0) return null;
            const heading =
                variant === 'planned'
                    ? t('habits.plannedToday', 'Habits planned for today')
                    : t(
                          'habits.completedHabitsToday',
                          'Habits completed today'
                      );
            return (
                <div className="mb-4 rounded-lg border border-dashed border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
                    <div className="px-4 py-2 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        {heading}
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {habitsList.map((habit, index) => {
                            const habitKey =
                                habit.uid ??
                                (habit.id
                                    ? `habit-${habit.id}`
                                    : `habit-${index}`);
                            const isProcessing = habitActionUid === habit.uid;
                            return (
                                <div
                                    key={habitKey}
                                    className="group flex items-center justify-between px-4 py-3 gap-3"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleHabitDetails(habit)
                                        }
                                        className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                                    >
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {habit.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'habits.targetFrequency',
                                                'Target Frequency'
                                            )}
                                            : {habit.habit_target_count || 1}x{' '}
                                            {t('common.per', 'per')}{' '}
                                            {getHabitPeriodLabel(
                                                habit.habit_frequency_period
                                            )}
                                        </p>
                                    </button>
                                    <div className="flex items-center gap-2 opacity-0 group hover:opacity-100 transition-opacity duration-200">
                                        <button
                                            onClick={() =>
                                                handleHabitToggle(habit)
                                            }
                                            disabled={isProcessing}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition ${
                                                variant === 'planned'
                                                    ? 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-900/40'
                                                    : 'border-yellow-200 text-yellow-600 hover:bg-yellow-50 dark:border-yellow-900 dark:text-yellow-400 dark:hover:bg-yellow-900/40'
                                            } ${
                                                isProcessing
                                                    ? 'opacity-60 cursor-not-allowed'
                                                    : ''
                                            }`}
                                        >
                                            {variant === 'planned'
                                                ? t(
                                                      'habits.complete',
                                                      'Complete'
                                                  )
                                                : t('common.undo', 'Undo')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        },
        [
            getHabitPeriodLabel,
            habitActionUid,
            handleHabitDetails,
            handleHabitToggle,
            t,
        ]
    );

    // Load data once on component mount
    useEffect(() => {
        loadHabitsStore();
    }, [loadHabitsStore]);

    useEffect(() => {
        isMounted.current = true;

        // Only fetch data once on mount
        const loadData = async () => {
            if (!isMounted.current || hasInitialized || isLoading) {
                return;
            }

            setIsLoading(true);
            try {
                const result = await fetchTasks(
                    `?type=today&limit=20&offset=0`
                );
                if (isMounted.current) {
                    setMetrics({
                        ...result.metrics,
                        // Store task arrays locally (fetched via include_lists=true)
                        tasks_in_progress: result.tasks_in_progress || [],
                        tasks_due_today: result.tasks_due_today || [],
                        tasks_overdue: result.tasks_overdue || [],
                        today_plan_tasks: result.tasks_today_plan || [],
                        suggested_tasks: result.suggested_tasks || [],
                        tasks_completed_today:
                            result.tasks_completed_today || [],
                    } as any);

                    // Merge all section tasks into the global store
                    // This ensures getTasksFromStore can find all tasks
                    const allSectionTasks = [
                        ...(result.tasks_in_progress || []),
                        ...(result.tasks_due_today || []),
                        ...(result.tasks_overdue || []),
                        ...(result.tasks_today_plan || []),
                        ...(result.suggested_tasks || []),
                        ...(result.tasks_completed_today || []),
                    ];
                    const taskMap = new Map<number, Task>();
                    // Add result.tasks first
                    (result.tasks || []).forEach((t: Task) =>
                        taskMap.set(t.id!, t)
                    );
                    // Then add section tasks (may override with more complete data)
                    allSectionTasks.forEach((t: Task) => taskMap.set(t.id!, t));
                    useStore
                        .getState()
                        .tasksStore.setTasks(Array.from(taskMap.values()));
                    setIsError(false);
                }

                // Preload tags to prevent re-renders when modal opens
                if (
                    isMounted.current &&
                    !tagsStore.hasLoaded &&
                    !tagsStore.isLoading
                ) {
                    tagsStore.loadTags();
                }
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                if (isMounted.current) {
                    setIsError(true);
                }
            }

            // Load all profile settings in a single API call instead of multiple calls
            try {
                const response = await fetch(getApiPath('profile'), {
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
                    getLocalesPath(`${i18n.language}/quotes.json`)
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
                        getLocalesPath('en/quotes.json')
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
                                      subtasks:
                                          taskToProcess.subtasks ||
                                          task.subtasks ||
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
                newMetrics.tasks_overdue = removeTask(
                    newMetrics.tasks_overdue || []
                );
                newMetrics.tasks_in_progress = removeTask(
                    newMetrics.tasks_in_progress || []
                );
                newMetrics.tasks_completed_today = removeTask(
                    newMetrics.tasks_completed_today || []
                ); // Always remove from completed first

                // Now, add the task to the appropriate list(s) based on its new status
                if (isTaskDone(updatedTask.status)) {
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
                    // Check if task has "today plan" status (in_progress, planned, or waiting)
                    const isInTodayPlan =
                        isTaskInProgress(updatedTask.status) ||
                        isTaskPlanned(updatedTask.status) ||
                        isTaskWaiting(updatedTask.status);
                    if (isInTodayPlan && updatedTask.status !== 'cancelled') {
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
                    // Check if task has a due date (and not already in today_plan_tasks or in_progress)
                    if (
                        updatedTask.due_date &&
                        updatedTask.status !== 'cancelled' &&
                        !newMetrics.today_plan_tasks.some(
                            (t) => t.id === updatedTask.id
                        ) &&
                        !newMetrics.tasks_in_progress.some(
                            (t) => t.id === updatedTask.id
                        )
                    ) {
                        const today = new Date();
                        const todayStr = format(today, 'yyyy-MM-dd');
                        const dueDateStr = format(
                            new Date(updatedTask.due_date),
                            'yyyy-MM-dd'
                        );

                        if (dueDateStr === todayStr) {
                            // Due today
                            newMetrics.tasks_due_today = updateOrAddTask(
                                newMetrics.tasks_due_today,
                                updatedTask
                            );
                        } else if (dueDateStr < todayStr) {
                            // Overdue
                            newMetrics.tasks_overdue = updateOrAddTask(
                                newMetrics.tasks_overdue,
                                updatedTask
                            );
                        }
                    }
                    // Task is suggested if not in today plan, no project, and no due date
                    const notInTodayPlan =
                        !isTaskInProgress(updatedTask.status) &&
                        !isTaskPlanned(updatedTask.status) &&
                        !isTaskWaiting(updatedTask.status);
                    const isSuggested =
                        notInTodayPlan &&
                        !updatedTask.project_id &&
                        !updatedTask.due_date;
                    const isActive = isTaskActive(updatedTask.status);

                    if (
                        isSuggested &&
                        isActive &&
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
                    newMetrics.tasks_overdue.length +
                    newMetrics.tasks_in_progress.length;

                return newMetrics;
            });

            // Update the store with the updated task
            useStore.getState().tasksStore.updateTaskInStore(updatedTask);

            try {
                // Make API call to persist the change and get the updated task from server
                const updatedTaskFromServer = await updateTask(
                    updatedTask.uid!,
                    updatedTask
                );

                // Update the UI again with the actual server response to ensure consistency
                setMetrics((prevMetrics) => {
                    const newMetrics = { ...prevMetrics };

                    // Helper to update task in a list with server data
                    const updateTaskInList = (list: Task[]) => {
                        return list.map((task) =>
                            task.id === updatedTaskFromServer.id
                                ? {
                                      ...task,
                                      ...updatedTaskFromServer,
                                      subtasks:
                                          updatedTaskFromServer.subtasks ||
                                          task.subtasks ||
                                          [],
                                  }
                                : task
                        );
                    };

                    // Update task in all relevant lists with server data
                    if (newMetrics.today_plan_tasks) {
                        newMetrics.today_plan_tasks = updateTaskInList(
                            newMetrics.today_plan_tasks
                        );
                    }
                    if (newMetrics.suggested_tasks) {
                        newMetrics.suggested_tasks = updateTaskInList(
                            newMetrics.suggested_tasks
                        );
                    }
                    if (newMetrics.tasks_due_today) {
                        newMetrics.tasks_due_today = updateTaskInList(
                            newMetrics.tasks_due_today
                        );
                    }
                    if (newMetrics.tasks_overdue) {
                        newMetrics.tasks_overdue = updateTaskInList(
                            newMetrics.tasks_overdue
                        );
                    }
                    if (newMetrics.tasks_in_progress) {
                        newMetrics.tasks_in_progress = updateTaskInList(
                            newMetrics.tasks_in_progress
                        );
                    }
                    if (newMetrics.tasks_completed_today) {
                        newMetrics.tasks_completed_today = updateTaskInList(
                            newMetrics.tasks_completed_today
                        );
                    }

                    return newMetrics;
                });

                // Also update the store with server response
                useStore
                    .getState()
                    .tasksStore.updateTaskInStore(updatedTaskFromServer);
            } catch (error) {
                console.error('Error updating task:', error);
                // Revert UI on error if necessary, or re-fetch to sync
                // For now, just log the error
            }
        },
        [] // Dependencies are now handled by direct state manipulation
    );

    const handleTaskDelete = useCallback(
        async (taskUid: string): Promise<void> => {
            if (!isMounted.current) return;

            try {
                await deleteTask(taskUid);

                // Reload tasks to reflect the change
                const result = await fetchTasks('?type=today');
                if (isMounted.current) {
                    useStore.getState().tasksStore.setTasks(result.tasks);
                    setMetrics({
                        ...result.metrics,
                        tasks_in_progress: result.tasks_in_progress || [],
                        tasks_due_today: result.tasks_due_today || [],
                        tasks_overdue: result.tasks_overdue || [],
                        today_plan_tasks: result.tasks_today_plan || [],
                        suggested_tasks: result.suggested_tasks || [],
                        tasks_completed_today:
                            result.tasks_completed_today || [],
                    } as any);
                }
            } catch (error) {
                console.error('Error deleting task:', error);
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

                // Check if this was a recurring task completion that needs refresh
                // Recurring tasks get advanced after completion, so they won't appear in completed list
                // without a refetch
                const isRecurringParent =
                    updatedTask.recurrence_type &&
                    updatedTask.recurrence_type !== 'none' &&
                    !updatedTask.recurring_parent_id;

                if (isRecurringParent) {
                    // Refetch tasks to get the updated completed list for recurring tasks
                    const result = await fetchTasks('?type=today');
                    if (isMounted.current) {
                        setMetrics((prevMetrics) => ({
                            ...prevMetrics,
                            tasks_completed_today:
                                result.tasks_completed_today || [],
                        }));
                    }
                }
            } catch (error) {
                console.error('Error toggling task completion:', error);
            }
        },
        [handleTaskUpdate]
    );

    // Calculate today's progress for the progress bar
    const getTodayProgress = () => {
        const todayTasks = plannedTasks;
        const completedToday = completedTasksList.length;
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
    const totalPlannedItems = plannedTasks.length + plannedHabits.length;
    const totalCompletedItems =
        completedTasksList.length + completedHabits.length;

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
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full max-w-5xl mx-auto">
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
                                {/* Total Tasks */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <ClipboardDocumentListIcon className="h-4 w-4 text-blue-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.total')}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold">
                                        {metrics.total_open_tasks}
                                    </p>
                                </div>

                                {/* In Progress */}
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

                                {/* Active Projects */}
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
                                                  (project) =>
                                                      project.status &&
                                                      [
                                                          'planned',
                                                          'in_progress',
                                                          'waiting',
                                                      ].includes(project.status)
                                              ).length
                                            : 0}
                                    </p>
                                </div>

                                {/* Due Today */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CalendarDaysIcon className="h-4 w-4 text-red-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.dueToday')}
                                        </p>
                                    </div>
                                    <p className={`text-sm font-semibold ${metrics.tasks_due_today.length > 0 ? 'text-red-500' : ''}`}>
                                        {metrics.tasks_due_today.length}
                                    </p>
                                </div>

                                {/* Overdue */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 mr-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('tasks.overdue', 'Overdue')}
                                        </p>
                                    </div>
                                    <p className={`text-sm font-semibold ${metrics.tasks_overdue.length > 0 ? 'text-red-500' : ''}`}>
                                        {metrics.tasks_overdue.length}
                                    </p>
                                </div>

                                {/* Completed Today */}
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
                                                    <p className={`text-sm font-semibold ${metrics.tasks_completed_today.length > 0 ? 'text-green-500' : ''}`}>
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
                                tasks_due_today: sortedDueTodayTasks,
                                suggested_tasks: sortedSuggestedTasks,
                                tasks_in_progress: metrics.tasks_in_progress,
                                today_plan_tasks: plannedTasks,
                            }}
                            projects={localProjects}
                            onTaskUpdate={handleTaskUpdate}
                            onClose={handleCloseNextTaskSuggestion}
                        />
                    </div>
                ) : null}

                {/* Overdue Tasks - Displayed first */}
                {isSettingsLoaded &&
                    todaySettings.showDueToday &&
                    sortedOverdueTasks.length > 0 && (
                        <div className="mb-6" data-testid="overdue-section">
                            <div
                                className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                                onClick={toggleOverdueCollapsed}
                                data-testid="overdue-section-header"
                            >
                                <h3 className="text-sm font-medium uppercase text-red-600 dark:text-red-400">
                                    {t('tasks.overdue', 'Overdue')}
                                </h3>
                                <div className="flex items-center">
                                    <span className="text-sm text-gray-500 mr-2">
                                        {sortedOverdueTasks.length}
                                    </span>
                                    {isOverdueCollapsed ? (
                                        <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                    ) : (
                                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                    )}
                                </div>
                            </div>
                            {!isOverdueCollapsed && (
                                <>
                                    <TaskList
                                        tasks={sortedOverdueTasks.slice(
                                            0,
                                            overdueDisplayLimit
                                        )}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskDelete={handleTaskDelete}
                                        projects={localProjects}
                                        onToggleToday={undefined}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                    />

                                    {/* Load More Buttons for Overdue Tasks */}
                                    {overdueDisplayLimit <
                                        sortedOverdueTasks.length && (
                                        <div className="flex justify-center pt-4 pb-2 gap-3">
                                            <button
                                                onClick={() =>
                                                    setOverdueDisplayLimit(
                                                        (prev) => prev + 20
                                                    )
                                                }
                                                className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            >
                                                <QueueListIcon className="h-4 w-4 mr-2" />
                                                {t(
                                                    'common.loadMore',
                                                    'Load More'
                                                )}
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setOverdueDisplayLimit(
                                                        sortedOverdueTasks.length
                                                    )
                                                }
                                                className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            >
                                                {t(
                                                    'common.showAll',
                                                    'Show All'
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Pagination info for Overdue tasks */}
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                        {t(
                                            'tasks.showingItems',
                                            'Showing {{current}} of {{total}} tasks',
                                            {
                                                current: Math.min(
                                                    overdueDisplayLimit,
                                                    sortedOverdueTasks.length
                                                ),
                                                total: sortedOverdueTasks.length,
                                            }
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                {/* Today Plan */}
                {totalPlannedItems > 0 && (
                    <div className="mb-6" data-testid="planned-section">
                        <div
                            className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                            onClick={toggleTodayPlanCollapsed}
                            data-testid="planned-section-header"
                        >
                            <h3 className="text-sm font-medium uppercase">
                                {t('tasks.planned', 'Planned')}
                            </h3>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-2">
                                    {totalPlannedItems}
                                </span>
                                {isTodayPlanCollapsed ? (
                                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                        </div>
                        {!isTodayPlanCollapsed && (
                            <>
                                {renderHabitList(plannedHabits, 'planned')}
                                {plannedTasks.length > 0 && (
                                    <>
                                        <TodayPlan
                                            todayPlanTasks={plannedTasks.slice(
                                                0,
                                                plannedDisplayLimit
                                            )}
                                            projects={localProjects}
                                            onTaskUpdate={handleTaskUpdate}
                                            onTaskDelete={handleTaskDelete}
                                            onToggleToday={undefined}
                                            onTaskCompletionToggle={
                                                handleTaskCompletionToggle
                                            }
                                        />

                                        {/* Load More Buttons for Planned Tasks */}
                                        {plannedDisplayLimit <
                                            plannedTasks.length && (
                                            <div className="flex justify-center pt-4 pb-2 gap-3">
                                                <button
                                                    onClick={() =>
                                                        setPlannedDisplayLimit(
                                                            (prev) => prev + 20
                                                        )
                                                    }
                                                    className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                >
                                                    <QueueListIcon className="h-4 w-4 mr-2" />
                                                    {t(
                                                        'common.loadMore',
                                                        'Load More'
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setPlannedDisplayLimit(
                                                            plannedTasks.length
                                                        )
                                                    }
                                                    className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                >
                                                    {t(
                                                        'common.showAll',
                                                        'Show All'
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pagination info for Planned tasks */}
                                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                            {t(
                                                'tasks.showingItems',
                                                'Showing {{current}} of {{total}} tasks',
                                                {
                                                    current: Math.min(
                                                        plannedDisplayLimit,
                                                        plannedTasks.length
                                                    ),
                                                    total: plannedTasks.length,
                                                }
                                            )}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Due Today Tasks */}
                {isSettingsLoaded &&
                    todaySettings.showDueToday &&
                    sortedDueTodayTasks.length > 0 && (
                        <div className="mb-6" data-testid="due-today-section">
                            <div
                                className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                                onClick={toggleDueTodayCollapsed}
                                data-testid="due-today-section-header"
                            >
                                <h3 className="text-sm font-medium uppercase">
                                    {t('tasks.dueToday')}
                                </h3>
                                <div className="flex items-center">
                                    <span className="text-sm text-gray-500 mr-2">
                                        {sortedDueTodayTasks.length}
                                    </span>
                                    {isDueTodayCollapsed ? (
                                        <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                    ) : (
                                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                    )}
                                </div>
                            </div>
                            {!isDueTodayCollapsed && (
                                <>
                                    <TaskList
                                        tasks={sortedDueTodayTasks.slice(
                                            0,
                                            dueTodayDisplayLimit
                                        )}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskDelete={handleTaskDelete}
                                        projects={localProjects}
                                        onToggleToday={undefined}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                    />

                                    {/* Load More Buttons for Due Today Tasks */}
                                    {dueTodayDisplayLimit <
                                        sortedDueTodayTasks.length && (
                                        <div className="flex justify-center pt-4 pb-2 gap-3">
                                            <button
                                                onClick={() =>
                                                    setDueTodayDisplayLimit(
                                                        (prev) => prev + 20
                                                    )
                                                }
                                                className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            >
                                                <QueueListIcon className="h-4 w-4 mr-2" />
                                                {t(
                                                    'common.loadMore',
                                                    'Load More'
                                                )}
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setDueTodayDisplayLimit(
                                                        sortedDueTodayTasks.length
                                                    )
                                                }
                                                className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            >
                                                {t(
                                                    'common.showAll',
                                                    'Show All'
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Pagination info for Due Today tasks */}
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                        {t(
                                            'tasks.showingItems',
                                            'Showing {{current}} of {{total}} tasks',
                                            {
                                                current: Math.min(
                                                    dueTodayDisplayLimit,
                                                    sortedDueTodayTasks.length
                                                ),
                                                total: sortedDueTodayTasks.length,
                                            }
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

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
                  sortedSuggestedTasks.length > 0 ? (
                    <div className="mt-2 mb-6">
                        <div
                            className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                            onClick={toggleSuggestedCollapsed}
                        >
                            <h3 className="text-sm font-medium uppercase">
                                {t('tasks.suggested')}
                            </h3>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-2">
                                    {sortedSuggestedTasks.length}
                                </span>
                                {isSuggestedCollapsed ? (
                                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                        </div>
                        {!isSuggestedCollapsed && (
                            <>
                                <TaskList
                                    tasks={sortedSuggestedTasks.slice(
                                        0,
                                        suggestedDisplayLimit
                                    )}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskCompletionToggle={
                                        handleTaskCompletionToggle
                                    }
                                    onTaskDelete={handleTaskDelete}
                                    projects={localProjects}
                                    onToggleToday={undefined}
                                />

                                {suggestedDisplayLimit <
                                    sortedSuggestedTasks.length && (
                                    <div className="flex justify-center pt-4 pb-2 gap-3">
                                        <button
                                            onClick={() =>
                                                setSuggestedDisplayLimit(
                                                    (prev) => prev + 20
                                                )
                                            }
                                            className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        >
                                            <QueueListIcon className="h-4 w-4 mr-2" />
                                            {t('common.loadMore', 'Load More')}
                                        </button>
                                        <button
                                            onClick={() =>
                                                setSuggestedDisplayLimit(
                                                    sortedSuggestedTasks.length
                                                )
                                            }
                                            className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        >
                                            {t('common.showAll', 'Show All')}
                                        </button>
                                    </div>
                                )}

                                <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                    {t(
                                        'tasks.showingItems',
                                        'Showing {{current}} of {{total}} tasks',
                                        {
                                            current: Math.min(
                                                suggestedDisplayLimit,
                                                sortedSuggestedTasks.length
                                            ),
                                            total: sortedSuggestedTasks.length,
                                        }
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                {/* Completed Tasks - Conditionally Rendered */}
                {isSettingsLoaded && todaySettings.showCompleted && (
                    <div className="mb-6" data-testid="completed-section">
                        <div
                            className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                            onClick={toggleCompletedCollapsed}
                            data-testid="completed-section-header"
                        >
                            <h3
                                className={`text-sm font-medium uppercase ${totalCompletedItems > 0 ? 'text-green-600 dark:text-green-400' : ''}`}
                            >
                                {t('tasks.completedToday')}
                            </h3>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-2">
                                    {totalCompletedItems}
                                </span>
                                {isCompletedCollapsed ? (
                                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                        </div>
                        {!isCompletedCollapsed && (
                            <>
                                {renderHabitList(completedHabits, 'completed')}
                                {completedTasksList.length > 0 && (
                                    <>
                                        <TaskList
                                            tasks={completedTasksList.slice(
                                                0,
                                                completedTodayDisplayLimit
                                            )}
                                            onTaskUpdate={handleTaskUpdate}
                                            onTaskDelete={handleTaskDelete}
                                            projects={localProjects}
                                            onToggleToday={undefined}
                                            showCompletedTasks={true}
                                        />

                                        {/* Load More Buttons for Completed Today Tasks */}
                                        {completedTodayDisplayLimit <
                                            completedTasksList.length && (
                                            <div className="flex justify-center pt-4 pb-2 gap-3">
                                                <button
                                                    onClick={() =>
                                                        setCompletedTodayDisplayLimit(
                                                            (prev) => prev + 20
                                                        )
                                                    }
                                                    className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                >
                                                    <QueueListIcon className="h-4 w-4 mr-2" />
                                                    {t(
                                                        'common.loadMore',
                                                        'Load More'
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setCompletedTodayDisplayLimit(
                                                            completedTasksList.length
                                                        )
                                                    }
                                                    className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                >
                                                    {t(
                                                        'common.showAll',
                                                        'Show All'
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pagination info for Completed Today tasks */}
                                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                            {t(
                                                'tasks.showingItems',
                                                'Showing {{current}} of {{total}} tasks',
                                                {
                                                    current: Math.min(
                                                        completedTodayDisplayLimit,
                                                        completedTasksList.length
                                                    ),
                                                    total: completedTasksList.length,
                                                }
                                            )}
                                        </div>
                                    </>
                                )}
                                {completedTasksList.length === 0 &&
                                    completedHabits.length === 0 && (
                                        <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
                                            {t(
                                                'tasks.noCompletedTasksToday',
                                                'No completed tasks today.'
                                            )}
                                        </p>
                                    )}
                            </>
                        )}
                    </div>
                )}

                {metrics.tasks_due_today.length === 0 &&
                    metrics.tasks_in_progress.length === 0 &&
                    sortedSuggestedTasks.length === 0 &&
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
