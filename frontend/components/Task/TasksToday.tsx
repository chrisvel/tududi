import React, { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { el, enUS, es, ja, uk, de } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
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
  CogIcon,
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
import TodaySettingsDropdown from "./TodaySettingsDropdown";
import { getProductivityAssistantEnabled, getNextTaskSuggestionEnabled } from "../../utils/profileService";
import { toggleTaskToday } from "../../utils/tasksService";

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
  const [dailyQuote, setDailyQuote] = useState<string>('');
  const [productivityAssistantEnabled, setProductivityAssistantEnabled] = useState(true);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [todaySettings, setTodaySettings] = useState({
    showMetrics: false,
    showProductivity: false,
    showIntelligence: false,
    showDueToday: true,
    showCompleted: true,
    showProgressBar: true, // Always enabled
    showDailyQuote: true,
  });
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

      // Load daily quote from translations
      try {
        const response = await fetch(`/locales/${i18n.language}/quotes.json`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted.current && data.quotes && data.quotes.length > 0) {
            // Get a random quote from the translated quotes
            const randomIndex = Math.floor(Math.random() * data.quotes.length);
            setDailyQuote(data.quotes[randomIndex]);
          }
        } else {
          // Fallback to English if language file doesn't exist
          const fallbackResponse = await fetch('/locales/en/quotes.json');
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (isMounted.current && fallbackData.quotes && fallbackData.quotes.length > 0) {
              const randomIndex = Math.floor(Math.random() * fallbackData.quotes.length);
              setDailyQuote(fallbackData.quotes[randomIndex]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load daily quote:", error);
        // Ultimate fallback
        if (isMounted.current) {
          setDailyQuote("Focus on progress, not perfection.");
        }
      }

      // Load user settings
      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
        });
        if (response.ok) {
          const userData = await response.json();
          if (isMounted.current) {
            // Parse today_settings if it's a string, or use the object directly
            let settings;
            if (userData.today_settings) {
              if (typeof userData.today_settings === 'string') {
                try {
                  settings = JSON.parse(userData.today_settings);
                } catch (error) {
                  console.error('Error parsing today_settings:', error);
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
              showIntelligence: false,
              showDueToday: true,
              showCompleted: true,
              showProgressBar: true, // Always enabled
              showDailyQuote: true,
            };
            
            // Ensure progress bar is always enabled
            settings.showProgressBar = true;
            
            setTodaySettings(settings);
          }
        }
      } catch (error) {
        console.error("Failed to load user settings:", error);
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
  
  

  // Calculate today's progress for the progress bar
  const getTodayProgress = () => {
    const todayTasks = metrics.today_plan_tasks || [];
    const completedToday = metrics.tasks_completed_today.length;
    const totalTodayTasks = todayTasks.length + completedToday;
    
    return {
      completed: completedToday,
      total: totalTodayTasks,
      percentage: totalTodayTasks === 0 ? 0 : Math.round((completedToday / totalTodayTasks) * 100)
    };
  };

  const todayProgress = getTodayProgress();

  // Handle settings change
  const handleSettingsChange = (newSettings: typeof todaySettings) => {
    setTodaySettings(newSettings);
  };

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
        <div className="flex flex-col">
          {/* Today Header with Icons on the Right */}
          <div className="mb-4">
            <div className="flex items-end justify-between mb-4">
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
              <div className="flex items-end space-x-2">
                <div className="relative">
                  <button
                    onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                    className="flex flex-row items-center p-2 group focus:outline-none rounded-md transition-all duration-200 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={t('settings.todayPageSettings', 'Today Page Settings')}
                  >
                    <CogIcon className="h-5 w-5" />
                    <span className="text-xs font-medium transition-all duration-200 max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-focus:max-w-xs group-focus:opacity-100 group-hover:ml-2 group-focus:ml-2">
                      {t('common.settings', 'Settings')}
                    </span>
                  </button>
                  
                  <TodaySettingsDropdown
                    isOpen={isSettingsDropdownOpen}
                    onClose={() => setIsSettingsDropdownOpen(false)}
                    settings={todaySettings}
                    onSettingsChange={handleSettingsChange}
                  />
                </div>
              </div>
            </div>
            
            {/* Today Progress Bar - integrated with header */}
            {todaySettings.showProgressBar && todayProgress.total > 0 && (
              <div className="mb-1">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div 
                    className="h-1 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-400 via-blue-500 to-blue-700"
                    style={{ width: `${todayProgress.percentage}%` }}
                  ></div>
                </div>
                {/* Daily Quote */}
                {todaySettings.showDailyQuote && dailyQuote && (
                  <div className="mt-2">
                    <p className="text-s text-gray-400 dark:text-gray-500 font-light text-left">
                      {dailyQuote}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metrics Section - Conditionally Rendered */}
        {todaySettings.showMetrics && (
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
        {todaySettings.showProductivity && productivityAssistantEnabled && (
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
        {todaySettings.showIntelligence && (
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
        {todaySettings.showDueToday && metrics.tasks_due_today.length > 0 && (
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
        {todaySettings.showCompleted && metrics.tasks_completed_today.length > 0 && (
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
