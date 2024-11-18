import React from "react";
import { format } from "date-fns";
import {
  ClipboardDocumentListIcon,
  ClockIcon,
  ArrowPathIcon,
  CalendarDaysIcon, // Import the icon for due tasks
} from "@heroicons/react/24/outline";

import { Task } from "../../entities/Task";
import { Project } from "../../entities/Project";

import useFetchTasks from "../../hooks/useFetchTasks";
import useFetchProjects from "../../hooks/useFetchProjects";
import useManageTasks from "../../hooks/useManageTasks";

import NewTask from "./NewTask";
import TaskList from "./TaskList";

const TasksToday: React.FC = () => {
  // Fetch tasks and metrics
  const {
    tasks,
    metrics,
    isLoading: loadingTasks,
    isError: errorTasks,
  } = useFetchTasks({
    type: "today",
  });

  // Fetch projects
  const {
    projects,
    isLoading: loadingProjects,
    isError: errorProjects,
  } = useFetchProjects();

  // Task management functions
  const { updateTask, deleteTask } = useManageTasks();

  // Handle task updates
  const handleTaskUpdate = (updatedTask: Task): void => {
    if (updatedTask.id === undefined) {
      console.error("Error updating task: Task ID is undefined.");
      return;
    }
    updateTask(updatedTask.id, updatedTask)
      .then(() => {
        // Optionally, refetch tasks or update local state
      })
      .catch((error) => {
        console.error("Error updating task:", error);
      });
  };

  // Handle task deletion
  const handleTaskDelete = (taskId: number): void => {
    deleteTask(taskId)
      .then(() => {
        // Optionally, refetch tasks or update local state
      })
      .catch((error) => {
        console.error("Error deleting task:", error);
      });
  };

  // Handle loading and error states
  if (loadingTasks || loadingProjects) {
    return <p>Loading...</p>;
  }

  if (errorTasks) {
    return <p className="text-red-500">Error loading tasks.</p>;
  }

  if (errorProjects) {
    return <p className="text-red-500">Error loading projects.</p>;
  }

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-light flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2" /> Today
          </h2>
          <span className="ml-4 text-gray-500">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </span>
        </div>

        {/* Overview of Tasks */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Total Open Tasks */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 text-blue-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Backlog</p>
              <p className="text-2xl font-semibold">{metrics.total_open_tasks}</p>
            </div>
          </div>

          {/* Tasks Pending Over a Month */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ClockIcon className="h-8 w-8 text-yellow-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Stale</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_pending_over_month}
              </p>
            </div>
          </div>

          {/* Tasks In Progress */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <ArrowPathIcon className="h-8 w-8 text-green-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">In Progress</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_in_progress_count}
              </p>
            </div>
          </div>

          {/* Tasks Due Today */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow flex items-center">
            <CalendarDaysIcon className="h-8 w-8 text-red-500 mr-4" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Due Today</p>
              <p className="text-2xl font-semibold">
                {metrics.tasks_due_today.length}
              </p>
            </div>
          </div>
        </div>

        {/* Tasks Due Today */}
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

        {/* Tasks In Progress */}
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

        {/* Suggested Tasks */}
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

        {/* Fallback Message */}
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
