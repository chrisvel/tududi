import React, { useEffect } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
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
import { loadInboxItemsToStore } from "../../utils/inboxService";
import { Task } from "../../entities/Task";
import { useStore } from "../../store/useStore";
import TaskList from "./TaskList";
import { Metrics } from "../../entities/Metrics";

const TasksToday: React.FC = () => {
  const { t } = useTranslation();
  const {
    tasks,
    setTasks,
    setLoading: setTasksLoading,
    setError: setTasksError,
  } = useStore((state) => state.tasksStore);
  const {
    projects,
    setProjects,
    setLoading: setProjectsLoading,
    setError: setProjectsError,
  } = useStore((state) => state.projectsStore);
  const { inboxItems } = useStore((state) => state.inboxStore);

  const [metrics, setMetrics] = React.useState<Metrics>({
    total_open_tasks: 0,
    tasks_pending_over_month: 0,
    tasks_in_progress_count: 0,
    tasks_in_progress: [],
    tasks_due_today: [],
    suggested_tasks: [],
  });

  useEffect(() => {
    const loadData = async () => {
      setTasksLoading(true);
      setProjectsLoading(true);
      try {
        const response = await fetchProjects();
        setProjects(response.projects);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        setProjectsError(true);
      } finally {
        setProjectsLoading(false);
      }
      
      try {
        const { tasks: fetchedTasks, metrics: fetchedMetrics } = await fetchTasks("?type=today");
        setTasks(fetchedTasks);
        setMetrics(fetchedMetrics);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        setTasksError(true);
      } finally {
        setTasksLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array as the effect should only run once on mount

  const handleTaskUpdate = async (updatedTask: Task): Promise<void> => {
    if (!updatedTask.id) return;

    try {
      setTasksLoading(true);
      await updateTask(updatedTask.id, updatedTask);
      const { tasks: updatedTasks, metrics } = await fetchTasks("?type=today");
      setTasks(updatedTasks);
      setMetrics(metrics);
    } catch (error) {
      console.error("Error updating task:", error);
      setTasksError(true);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleTaskDelete = async (taskId: number): Promise<void> => {
    try {
      setTasksLoading(true);
      await deleteTask(taskId);
      const { tasks: updatedTasks, metrics } = await fetchTasks("?type=today");
      setTasks(updatedTasks);
      setMetrics(metrics);
    } catch (error) {
      console.error("Error deleting task:", error);
      setTasksError(true);
    } finally {
      setTasksLoading(false);
    }
  };

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-light flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2" /> {t('tasks.today')}
          </h2>
          <span className="ml-4 text-gray-500">
            {format(new Date(), t('dateFormats.long'))}
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
                  {projects.filter(project => project.active).length}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ArchiveBoxIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('projects.inactive', 'Inactive Projects')}</p>
                </div>
                <p className="text-xl font-semibold">
                  {projects.filter(project => !project.active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inbox Notification */}
        {inboxItems.length > 0 && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-900 border-l-4 border-blue-500 rounded-lg shadow">
            <Link to="/inbox" className="flex items-center">
              <InboxIcon className="h-6 w-6 text-blue-500 dark:text-blue-400 mr-3" />
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {t('inbox.unprocessedItems', { count: inboxItems.length, defaultValue: `You have ${inboxItems.length} item(s) in your inbox.` })}
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
              projects={projects}
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
              projects={projects}
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
              projects={projects}
            />
          </>
        )}

        {tasks.length === 0 && (
          <p className="text-gray-500 text-center mt-4">
            {t('tasks.noTasksAvailable')}
          </p>
        )}
      </div>
    </div>
  );
};

export default TasksToday;
