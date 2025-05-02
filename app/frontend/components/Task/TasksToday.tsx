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
  ClockIcon,
  InboxIcon,
  FolderIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { fetchTasks, updateTask, deleteTask } from "../../utils/tasksService";
import { fetchProjects } from "../../utils/projectsService";
import { Task } from "../../entities/Task";
import { useStore } from "../../store/useStore";
import TaskList from "./TaskList";
import { Metrics } from "../../entities/Metrics";

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
  
  // Metrics from the API
  const [metrics, setMetrics] = useState<Metrics>({
    total_open_tasks: 0,
    tasks_pending_over_month: 0,
    tasks_in_progress_count: 0,
    tasks_in_progress: [],
    tasks_due_today: [],
    suggested_tasks: [],
  });

  // Track mounting state to prevent state updates after unmount
  const isMounted = React.useRef(false);
  
  // Load data once on component mount
  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch data once on mount
    const loadData = async () => {
      if (!isMounted.current) return;
      
      setIsLoading(true);
      setIsError(false);
      
      try {
        // Load projects first
        const projectsData = await fetchProjects();
        if (isMounted.current) {
          setLocalProjects(projectsData);
          // Also update the store
          store.projectsStore.setProjects(projectsData);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        if (isMounted.current) {
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

  // Get inbox items count from store for the notification
  const inboxItemsCount = store.inboxStore.inboxItems.length;

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
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-light flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2" /> {t('tasks.today')}
          </h2>
          <span className="ml-4 text-gray-500">
            {format(new Date(), t('dateFormats.long', { date: new Date() }), { locale: getLocale(i18n.language) })}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Task Metrics */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">{t('tasks.metrics', 'Tasks')}</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ClipboardDocumentListIcon className="h-6 w-6 text-blue-500 mr-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.backlog')}</p>
                  </div>
                  <p className="text-xl font-semibold">
                    {metrics.total_open_tasks}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ArrowPathIcon className="h-6 w-6 text-green-500 mr-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.inProgress')}</p>
                  </div>
                  <p className="text-xl font-semibold">
                    {metrics.tasks_in_progress_count}
                  </p>
                </div>
              </div>
              
              {/* Right column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarDaysIcon className="h-6 w-6 text-red-500 mr-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.dueToday')}</p>
                  </div>
                  <p className="text-xl font-semibold">
                    {metrics.tasks_due_today.length}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ClockIcon className="h-6 w-6 text-yellow-500 mr-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.stale')}</p>
                  </div>
                  <p className="text-xl font-semibold">
                    {metrics.tasks_pending_over_month}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Metrics */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">{t('projects.metrics', 'Projects')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FolderIcon className="h-6 w-6 text-blue-500 mr-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('projects.active', 'Active Projects')}</p>
                </div>
                <p className="text-xl font-semibold">
                  {localProjects.filter(project => project.active).length}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ArchiveBoxIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('projects.inactive', 'Inactive Projects')}</p>
                </div>
                <p className="text-xl font-semibold">
                  {localProjects.filter(project => !project.active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inbox Notification */}
        {inboxItemsCount > 0 && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-900 border-l-4 border-blue-500 rounded-lg shadow">
            <Link to="/inbox" className="flex items-center">
              <InboxIcon className="h-6 w-6 text-blue-500 dark:text-blue-400 mr-3" />
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {t('inbox.unprocessedItems', { count: inboxItemsCount, defaultValue: `You have ${inboxItemsCount} item(s) in your inbox.` })}
                </p>
                <p className="text-blue-600 dark:text-blue-400 text-sm">
                  {t('inbox.processNow', 'Process them now')}
                </p>
              </div>
            </Link>
          </div>
        )}

        {metrics.tasks_due_today.length > 0 && (
          <>
            <h3 className="text-xl font-medium mt-6 mb-2">{t('tasks.dueToday')}</h3>
            <TaskList
              tasks={metrics.tasks_due_today}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={localProjects}
            />
          </>
        )}

        {metrics.tasks_in_progress.length > 0 && (
          <>
            <h3 className="text-xl font-medium mt-6 mb-2">{t('tasks.inProgress')}</h3>
            <TaskList
              tasks={metrics.tasks_in_progress}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={localProjects}
            />
          </>
        )}

        {metrics.suggested_tasks.length > 0 && (
          <>
            <h3 className="text-xl font-medium mt-6 mb-2">{t('tasks.suggested')}</h3>
            <TaskList
              tasks={metrics.suggested_tasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={localProjects}
            />
          </>
        )}

        {localTasks.length === 0 && (
          <p className="text-gray-500 text-center mt-4">
            {t('tasks.noTasksAvailable')}
          </p>
        )}
      </div>
    </div>
  );
};

export default TasksToday;
