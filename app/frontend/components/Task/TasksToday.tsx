import React, { useEffect } from "react";
import { format } from "date-fns";
import {
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { fetchTasks, updateTask, deleteTask } from "../../utils/tasksService";
import { fetchProjects } from "../../utils/projectsService";
import { Task } from "../../entities/Task";
import { useStore } from "../../store/useStore";
import TaskList from "./TaskList";
import { Metrics } from "../../entities/Metrics";

const TasksToday: React.FC = () => {
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
      try {
        // setProjectsLoading(true);
        const projectsData = await fetchProjects();
        setProjects(projectsData);

        const { tasks: fetchedTasks, metrics } = await fetchTasks("?type=today");
        setTasks(fetchedTasks);
        setMetrics(metrics);
      } catch (error) {
        console.error("Error loading data:", error);
        setProjectsError(true);
        setTasksError(true);
      } finally {
        // setProjectsLoading(false);
        // setTasksLoading(false);
      }
    };

    loadData();
  }, [setProjects, setProjectsLoading, setProjectsError, setTasks, setTasksLoading, setTasksError]);

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

  const todayDate = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-light flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2" /> Today
          </h2>
          <span className="ml-4 text-gray-500">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 text-blue-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Backlog</p>
              <p className="text-2xl font-semibold">
                {metrics.total_open_tasks}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ArrowPathIcon className="h-8 w-8 text-green-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">In Progress</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_in_progress_count}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <CalendarDaysIcon className="h-8 w-8 text-red-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Due Today</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_due_today.length}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ClockIcon className="h-8 w-8 text-yellow-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Stale</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_pending_over_month}
              </p>
            </div>
          </div>
        </div>

        {metrics.tasks_due_today.length > 0 && (
          <>
            <h3 className="text-xl font-medium mt-6 mb-2">Tasks Due Today</h3>
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
            <h3 className="text-xl font-medium mt-6 mb-2">Tasks In Progress</h3>
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
            <h3 className="text-xl font-medium mt-6 mb-2">Suggested Tasks</h3>
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
            No tasks available for today.
          </p>
        )}
      </div>
    </div>
  );
};

export default TasksToday;