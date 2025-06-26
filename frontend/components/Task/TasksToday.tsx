import React, { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { el, enUS, es, ja, uk, de } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { Link } from "react-router-dom";
import {
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  FolderIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChartBarIcon,
  BellIcon,
  LightBulbIcon,
  SparklesIcon,
  TrophyIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { fetchTasks, updateTask, deleteTask } from "../../utils/tasksService";
import { fetchProjects } from "../../utils/projectsService";
import { Task } from "../../entities/Task";
import { useStore } from "../../store/useStore";
import TaskList from "./TaskList";
import TodayPlan from "./TodayPlan";
import { Metrics } from "../../entities/Metrics";
import ProductivityAssistant from "../Productivity/ProductivityAssistant";
import NextTaskSuggestion from "./NextTaskSuggestion";
import WeeklyCompletionChart from "./WeeklyCompletionChart";
import { getProductivityAssistantEnabled, getNextTaskSuggestionEnabled } from "../../utils/profileService";
import { toggleTaskToday } from "../../utils/tasksService";
import { getVagueTasks } from "../../utils/taskIntelligenceService";

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
  
  // Don't use multiple separate useStore calls - combine them into one
  const store = useStore();
  
  // Use local state for data instead of directly using store state
  // This prevents unnecessary re-renders from store updates
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [localProjects, setLocalProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [productivityAssistantEnabled, setProductivityAssistantEnabled] = useState(true);
  const [nextTaskSuggestionEnabled, setNextTaskSuggestionEnabled] = useState(true);
  const [showNextTaskSuggestion, setShowNextTaskSuggestion] = useState(() => {
    const stored = sessionStorage.getItem('hideNextTaskSuggestion');
    return stored !== 'true';
  });
  const [isSuggestedCollapsed, setIsSuggestedCollapsed] = useState(() => {
    const stored = localStorage.getItem('suggestedTasksCollapsed');
    return stored === 'true';
  });
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(() => {
    const stored = localStorage.getItem('completedTasksCollapsed');
    return stored === 'true';
  });
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(() => {
    const stored = localStorage.getItem('metricsExpanded');
    return stored === 'true';
  });
  const [isProductivityExpanded, setIsProductivityExpanded] = useState(() => {
    const stored = localStorage.getItem('productivityExpanded');
    return stored === 'true';
  });
  const [isAiSuggestionExpanded, setIsAiSuggestionExpanded] = useState(() => {
    const stored = localStorage.getItem('aiSuggestionExpanded');
    return stored === 'true';
  });
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(() => {
    const stored = localStorage.getItem('completedExpanded');
    return stored !== 'false'; // Default to true (expanded)
  });
  const [isDueTodayExpanded, setIsDueTodayExpanded] = useState(() => {
    const stored = localStorage.getItem('dueTodayExpanded');
    return stored !== 'false'; // Default to true (expanded)
  });
  
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
        averageCount: 0
      };
    }
    
    // Sum all completed tasks from the weekly data
    const totalCompletedTasks = metrics.weekly_completions.reduce((sum, completion) => sum + completion.count, 0);
    
    // Average is total completed tasks divided by 7
    const averageCount = totalCompletedTasks / 7;
    
    // Calculate percentage change vs average
    let percentage = 0;
    if (averageCount > 0) {
      percentage = Math.round(((todayCount - averageCount) / averageCount) * 100);
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
        averageCount: Math.round(averageCount * 10) / 10 // Round to 1 decimal
      };
    } else if (todayCount < averageCount) {
      return { 
        direction: 'down', 
        difference: Math.round((averageCount - todayCount) * 10) / 10, // Round to 1 decimal
        percentage: Math.abs(percentage),
        todayCount,
        averageCount: Math.round(averageCount * 10) / 10 // Round to 1 decimal
      };
    } else {
      return { 
        direction: 'same', 
        difference: 0,
        percentage: 0,
        todayCount,
        averageCount: Math.round(averageCount * 10) / 10 // Round to 1 decimal
      };
    }
  };

  // Track mounting state to prevent state updates after unmount
  const isMounted = React.useRef(false);

  // Function to handle next task suggestion dismissal
  const handleCloseNextTaskSuggestion = () => {
    setShowNextTaskSuggestion(false);
    sessionStorage.setItem('hideNextTaskSuggestion', 'true');
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

  const toggleMetricsExpanded = () => {
    const newState = !isMetricsExpanded;
    setIsMetricsExpanded(newState);
    localStorage.setItem('metricsExpanded', newState.toString());
  };

  const toggleProductivityExpanded = () => {
    const newState = !isProductivityExpanded;
    setIsProductivityExpanded(newState);
    localStorage.setItem('productivityExpanded', newState.toString());
  };

  const toggleAiSuggestionExpanded = () => {
    const newState = !isAiSuggestionExpanded;
    setIsAiSuggestionExpanded(newState);
    localStorage.setItem('aiSuggestionExpanded', newState.toString());
  };

  const toggleCompletedExpanded = () => {
    const newState = !isCompletedExpanded;
    setIsCompletedExpanded(newState);
    localStorage.setItem('completedExpanded', newState.toString());
  };

  const toggleDueTodayExpanded = () => {
    const newState = !isDueTodayExpanded;
    setIsDueTodayExpanded(newState);
    localStorage.setItem('dueTodayExpanded', newState.toString());
  };
  
  // Load data once on component mount
  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch data once on mount
    const loadData = async () => {
      if (!isMounted.current) return;
      
      setIsLoading(true);
      setIsError(false);
      
      try {
        // Load productivity assistant setting
        const isEnabled = await getProductivityAssistantEnabled();
        if (isMounted.current) {
          setProductivityAssistantEnabled(isEnabled);
        }
      } catch (error) {
        console.error("Failed to load productivity assistant setting:", error);
      }
      
      try {
        // Load next task suggestion setting
        const isNextTaskEnabled = await getNextTaskSuggestionEnabled();
        if (isMounted.current) {
          setNextTaskSuggestionEnabled(isNextTaskEnabled);
        }
      } catch (error) {
        console.error("Failed to load next task suggestion setting:", error);
      }
      
      try {
        // Load projects first
        const projectsData = await fetchProjects();
        if (isMounted.current) {
          const safeProjectsData = Array.isArray(projectsData) ? projectsData : [];
          setLocalProjects(safeProjectsData);
          store.projectsStore.setProjects(safeProjectsData);
        }
      } catch (error) {
        console.error('Projects loading error:', error);
        if (isMounted.current) {
          setLocalProjects([]);
          setIsError(true);
        }
      }
      
      try {
        // Load tasks with metrics
        const { tasks: fetchedTasks, metrics: fetchedMetrics } = await fetchTasks("?type=today");
        if (isMounted.current) {
          setLocalTasks(fetchedTasks);
          setMetrics(fetchedMetrics);
          // Also update the store
          store.tasksStore.setTasks(fetchedTasks);
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        if (isMounted.current) {
          setIsError(true);
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Memoize task handlers to prevent recreating functions on each render
  const handleTaskUpdate = useCallback(async (updatedTask: Task): Promise<void> => {
    if (!updatedTask.id || !isMounted.current) return;

    setIsLoading(true);
    try {
      await updateTask(updatedTask.id, updatedTask);
      // Refetch data to ensure consistency
      const { tasks: updatedTasks, metrics } = await fetchTasks("?type=today");
      
      if (isMounted.current) {
        setLocalTasks(updatedTasks);
        setMetrics(metrics);
        // Update store
        store.tasksStore.setTasks(updatedTasks);
      }
    } catch (error) {
      console.error("Error updating task:", error);
      if (isMounted.current) {
        setIsError(true);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [store.tasksStore]);

  const handleTaskDelete = useCallback(async (taskId: number): Promise<void> => {
    if (!isMounted.current) return;
    
    setIsLoading(true);
    try {
      await deleteTask(taskId);
      // Refetch data to ensure consistency
      const { tasks: updatedTasks, metrics } = await fetchTasks("?type=today");
      
      if (isMounted.current) {
        setLocalTasks(updatedTasks);
        setMetrics(metrics);
        // Update store
        store.tasksStore.setTasks(updatedTasks);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      if (isMounted.current) {
        setIsError(true);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [store.tasksStore]);

  const handleToggleToday = useCallback(async (taskId: number): Promise<void> => {
    if (!isMounted.current) return;
    
    try {
      await toggleTaskToday(taskId);
      // Refetch data to ensure consistency
      const { tasks: updatedTasks, metrics } = await fetchTasks("?type=today");
      
      if (isMounted.current) {
        setLocalTasks(updatedTasks);
        setMetrics(metrics);
        // Update store
        store.tasksStore.setTasks(updatedTasks);
      }
    } catch (error) {
      console.error("Error toggling task today status:", error);
      if (isMounted.current) {
        setIsError(true);
      }
    }
  }, [store.tasksStore]);
  
  // Count productivity issues for badge (matching ProductivityAssistant logic)
  const getProductivityIssuesCount = () => {
    if (!productivityAssistantEnabled || !localTasks || !localProjects) return 0;
    
    let issueCount = 0;
    const activeTasks = localTasks.filter(task => task.status !== 'done' && task.status !== 'archived');
    
    // 1. Stalled Projects (no active tasks)
    const stalledProjects = localProjects.filter(project => 
      project.active && !activeTasks.some(task => task.project_id === project.id)
    );
    issueCount += stalledProjects.length;
    
    // 2. Projects with completed tasks but no next action
    const projectsNeedingNextAction = localProjects.filter(project => {
      const projectTasks = localTasks.filter(task => task.project_id === project.id);
      const hasCompletedTasks = projectTasks.some(task => task.status === 'done' || task.status === 'archived');
      const hasNextAction = activeTasks.some(task => 
        task.project_id === project.id && (task.status === 'not_started' || task.status === 'in_progress')
      );
      return project.active && hasCompletedTasks && !hasNextAction;
    });
    issueCount += projectsNeedingNextAction.length;
    
    // 3. Tasks that are actually projects
    const PROJECT_VERBS = ['plan', 'organize', 'set up', 'setup', 'fix', 'review', 'implement', 'create', 'build', 'develop'];
    const tasksAreProjects = activeTasks.filter(task => {
      const taskName = task.name.toLowerCase();
      return PROJECT_VERBS.some(verb => taskName.includes(verb)) && taskName.length > 30;
    });
    issueCount += tasksAreProjects.length;
    
    // 4. Vague tasks (using the same utility function as ProductivityAssistant)
    const vagueTasks = getVagueTasks(activeTasks);
    issueCount += vagueTasks.length;
    
    // 5. Stale tasks (created more than 30 days ago)
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const staleTasks = activeTasks.filter(task => {
      const taskDate = task.created_at ? new Date(task.created_at) : null;
      return taskDate && taskDate < thresholdDate;
    });
    issueCount += staleTasks.length;
    
    // 6. Stuck projects (projects with tasks but not updated recently)
    const stuckProjects = localProjects.filter(project => {
      if (!project.active) return false;
      
      // Projects don't have date fields, so check if they have recent tasks
      const projectTasks = activeTasks.filter(task => task.project_id === project.id);
      
      if (projectTasks.length === 0) return false; // Empty projects are handled by "stalled projects"
      
      // Find the most recent task date for this project
      const mostRecentTaskDate = projectTasks.reduce((latest, task) => {
        const taskDate = task.created_at ? new Date(task.created_at) : null;
        if (!taskDate) return latest;
        return !latest || taskDate > latest ? taskDate : latest;
      }, null as Date | null);
      
      return mostRecentTaskDate && mostRecentTaskDate < thresholdDate;
    });
    issueCount += stuckProjects.length;
    
    return issueCount;
  };
  
  const productivityIssuesCount = getProductivityIssuesCount();

  // Show loading state
  if (isLoading && localTasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  // Show error state
  if (isError && localTasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">{t('errors.somethingWentWrong', 'Something went wrong')}</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col mb-4">
          {/* Today Header with Icons on the Right */}
          <div className="flex items-end justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-end">
              <CalendarDaysIcon className="h-5 w-5 mr-2 mb-1" />
              <h2 className="text-2xl font-light mr-4">
                {t('tasks.today')}
              </h2>
              <span className="text-gray-500">
                {format(new Date(), "PPP", { locale: getLocale(i18n.language) })}
              </span>
            </div>
            
            {/* Today Navigation Icons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMetricsExpanded}
                className={`flex flex-row items-center p-2 group focus:outline-none rounded-md transition-all duration-200 ${
                  isMetricsExpanded 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={isMetricsExpanded ? t('dashboard.hideMetrics', 'Hide Metrics') : t('dashboard.showMetrics', 'Show Metrics')}
              >
                <ChartBarIcon className="h-4 w-4" />
                <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2">
                  {t('dashboard.metrics', 'Metrics')}
                </span>
              </button>

              <div className="relative group">
                <button
                  onClick={toggleProductivityExpanded}
                  className={`flex flex-row items-center p-2 focus:outline-none rounded-md transition-all duration-200 ${
                    isProductivityExpanded 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={isProductivityExpanded ? t('dashboard.hideInsights', 'Hide Insights') : t('dashboard.showInsights', 'Show Insights')}
                >
                  <LightBulbIcon className="h-4 w-4" />
                  <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2">
                    {t('dashboard.insights', 'Insights')}
                  </span>
                </button>
                {productivityIssuesCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
                )}
              </div>

              <button
                onClick={toggleAiSuggestionExpanded}
                className={`flex flex-row items-center p-2 group focus:outline-none rounded-md transition-all duration-200 ${
                  isAiSuggestionExpanded 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={isAiSuggestionExpanded ? t('dashboard.hideIntelligence', 'Hide Intelligence') : t('dashboard.showIntelligence', 'Show Intelligence')}
              >
                <SparklesIcon className="h-4 w-4" />
                <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2">
                  {t('dashboard.intelligence', 'Intelligence')}
                </span>
              </button>

              {metrics.tasks_due_today.length > 0 && (
                <div className="relative group">
                  <button
                    onClick={toggleDueTodayExpanded}
                    className={`flex flex-row items-center p-2 focus:outline-none rounded-md transition-all duration-200 ${
                      isDueTodayExpanded 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={isDueTodayExpanded ? t('dashboard.hideDueToday', 'Hide Due Today') : t('dashboard.showDueToday', 'Show Due Today')}
                  >
                    <ClockIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2 whitespace-nowrap">
                      {t('dashboard.dueToday', 'Due Today')}
                    </span>
                  </button>
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500"></span>
                </div>
              )}

              {metrics.tasks_completed_today.length > 0 && (
                <div className="relative group">
                  <button
                    onClick={toggleCompletedExpanded}
                    className={`flex flex-row items-center p-2 focus:outline-none rounded-md transition-all duration-200 ${
                      isCompletedExpanded 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={isCompletedExpanded ? t('dashboard.hideCompleted', 'Hide Completed') : t('dashboard.showCompleted', 'Show Completed')}
                  >
                    <TrophyIcon className="h-4 w-4" />
                    <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2">
                      {t('dashboard.completed', 'Completed')}
                    </span>
                  </button>
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Section - Conditionally Rendered */}
        {isMetricsExpanded && (
          <div className="mb-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Combined Task & Project Metrics */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{t('dashboard.overview')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClipboardDocumentListIcon className="h-4 w-4 text-blue-500 mr-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.backlog')}</p>
                </div>
                <p className="text-sm font-semibold">
                  {metrics.total_open_tasks}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ArrowPathIcon className="h-4 w-4 text-green-500 mr-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.inProgress')}</p>
                </div>
                <p className="text-sm font-semibold">
                  {metrics.tasks_in_progress_count}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CalendarDaysIcon className="h-4 w-4 text-red-500 mr-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.dueToday')}</p>
                </div>
                <p className="text-sm font-semibold">
                  {metrics.tasks_due_today.length}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.completedToday', 'Completed Today')}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {(() => {
                    const trend = getCompletionTrend();
                    const getTooltipText = () => {
                      if (trend.direction === 'same') {
                        return t('dashboard.sameAsAverage', 'Same as average');
                      } else if (trend.direction === 'up') {
                        return t('dashboard.betterThanAverage', '{{percentage}}% more than average', { percentage: trend.percentage });
                      } else {
                        return t('dashboard.worseThanAverage', '{{percentage}}% less than average', { percentage: trend.percentage });
                      }
                    };
                    
                    return (
                      <>
                        {(trend.direction === 'up' || trend.direction === 'down') && (
                          <div className="relative group">
                            {trend.direction === 'up' && (
                              <ArrowUpIcon className="h-3 w-3 text-green-500" />
                            )}
                            {trend.direction === 'down' && (
                              <ArrowDownIcon className="h-3 w-3 text-red-500" />
                            )}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              {getTooltipText()}
                            </div>
                          </div>
                        )}
                        <p className="text-sm font-semibold">
                          {metrics.tasks_completed_today.length}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FolderIcon className="h-4 w-4 text-purple-500 mr-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('projects.active')}</p>
                </div>
                <p className="text-sm font-semibold">
                  {Array.isArray(localProjects) ? localProjects.filter(project => project.active).length : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Weekly Completion Chart */}
          <div className="lg:col-span-2">
            <WeeklyCompletionChart data={metrics.weekly_completions} />
          </div>
          </div>
        )}

        {/* Productivity Assistant - Conditionally Rendered */}
        {productivityAssistantEnabled && isProductivityExpanded && (
          <ProductivityAssistant tasks={localTasks} projects={localProjects} />
        )}

        {/* Today Plan */}
        <TodayPlan
          todayPlanTasks={metrics.today_plan_tasks || []}
          projects={localProjects}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          onToggleToday={handleToggleToday}
        />

        {/* Intelligence - Conditionally Rendered - Appears after Today Plan */}
        {isAiSuggestionExpanded && (
          <div className="mt-8">
            {/* Next Task Suggestion */}
            {nextTaskSuggestionEnabled && showNextTaskSuggestion && (
              <NextTaskSuggestion 
                metrics={{
                  tasks_due_today: metrics.tasks_due_today,
                  suggested_tasks: metrics.suggested_tasks,
                  tasks_in_progress: metrics.tasks_in_progress,
                  today_plan_tasks: metrics.today_plan_tasks
                }}
                onTaskUpdate={handleTaskUpdate}
                onClose={handleCloseNextTaskSuggestion}
              />
            )}

            {/* Suggested Tasks */}
            {metrics.suggested_tasks.length > 0 && (
              <div className="mb-6">
                <div 
                  className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
                  onClick={toggleSuggestedCollapsed}
                >
                  <h3 className="text-xl font-medium">{t('tasks.suggested')}</h3>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">{metrics.suggested_tasks.length}</span>
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
                    onTaskDelete={handleTaskDelete}
                    projects={localProjects}
                    onToggleToday={handleToggleToday}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Due Today Tasks - Conditionally Rendered */}
        {isDueTodayExpanded && metrics.tasks_due_today.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-medium mt-6 mb-2">{t('tasks.dueToday')}</h3>
            <TaskList
              tasks={metrics.tasks_due_today}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={localProjects}
              onToggleToday={handleToggleToday}
            />
          </div>
        )}

        {/* Completed Tasks - Conditionally Rendered */}
        {isCompletedExpanded && metrics.tasks_completed_today.length > 0 && (
          <div className="mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer mt-6 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700"
              onClick={toggleCompletedCollapsed}
            >
              <h3 className="text-xl font-medium">{t('tasks.completedToday')}</h3>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">{metrics.tasks_completed_today.length}</span>
                {isCompletedCollapsed ? (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </div>
            {!isCompletedCollapsed && (
              <TaskList
                tasks={metrics.tasks_completed_today}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                projects={localProjects}
                  onToggleToday={handleToggleToday}
              />
            )}
          </div>
        )}

        {metrics.tasks_due_today.length === 0 && 
         metrics.tasks_in_progress.length === 0 && 
         metrics.suggested_tasks.length === 0 && (
          <p className="text-gray-500 text-center mt-4">
            {t('tasks.noTasksAvailable')}
          </p>
        )}
      </div>
    </div>
  );
};

export default TasksToday;
