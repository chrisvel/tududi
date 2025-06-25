import React from "react";
import { CalendarDaysIcon, CalendarIcon, PlayIcon } from "@heroicons/react/24/outline";
import { TagIcon, FolderIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import TaskPriorityIcon from "./TaskPriorityIcon";
import TaskTags from "./TaskTags";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskDueDate from "./TaskDueDate";
import TaskRecurrenceBadge from "./TaskRecurrenceBadge";
import { Project } from "../../entities/Project";
import { Task, StatusType } from "../../entities/Task";

interface TaskHeaderProps {
  task: Task;
  project?: Project;
  onTaskClick: (e: React.MouseEvent) => void;
  onToggleCompletion?: () => void;
  hideProjectName?: boolean;
  showTodayPlanControls?: boolean;
  onToggleToday?: (taskId: number) => Promise<void>;
  onTaskUpdate?: (task: Task) => Promise<void>;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  task,
  project,
  onTaskClick,
  onToggleCompletion,
  hideProjectName = false,
  showTodayPlanControls = false,
  onToggleToday,
  onTaskUpdate,
}) => {
  const { t } = useTranslation();

  const handleTodayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening task modal
    if (onToggleToday && task.id) {
      try {
        await onToggleToday(task.id);
      } catch (error) {
        console.error('Failed to toggle today status:', error);
      }
    }
  };

  const handlePlayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening task modal
    if (task.id && (task.status === 'not_started' || task.status === 'in_progress' || task.status === 0 || task.status === 1) && onTaskUpdate) {
      try {
        const isCurrentlyInProgress = task.status === 'in_progress' || task.status === 1;
        const updatedTask = {
          ...task,
          status: (isCurrentlyInProgress ? 'not_started' : 'in_progress') as StatusType,
          // Automatically add to today plan when setting to in_progress
          today: isCurrentlyInProgress ? task.today : true
        };
        await onTaskUpdate(updatedTask);
      } catch (error) {
        console.error('Failed to toggle in progress status:', error);
      }
    }
  };

  return (
    <div className="py-2 px-4 cursor-pointer group" onClick={onTaskClick}>
      {/* Full view (md and larger) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4 mb-2 md:mb-0">
          <TaskPriorityIcon priority={task.priority} status={task.status} onToggleCompletion={onToggleCompletion} />
          <div className="flex flex-col">
            <span className="text-md text-gray-900 dark:text-gray-100">
              {task.name}
            </span>
            {/* Project and tags in same row, with spacing when both exist */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              {project && !hideProjectName && (
                <div className="flex items-center">
                  <FolderIcon className="h-3 w-3 mr-1" />
                  <span>{project.name}</span>
                </div>
              )}
              {project && !hideProjectName && task.tags && task.tags.length > 0 && (
                <span className="mx-2">•</span>
              )}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center">
                  <TagIcon className="h-3 w-3 mr-1" />
                  <span>{task.tags.map(tag => tag.name).join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-start md:justify-end space-x-2">
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskRecurrenceBadge recurrenceType={task.recurrence_type || 'none'} />

          {/* Today Plan Controls */}
          {onToggleToday && (
            <button
              onClick={handleTodayToggle}
              className={`items-center justify-center ${
              Number(task.today_move_count) > 1 ? 'px-2 h-6' : 'w-6 h-6'
              } rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
              task.today 
                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 flex'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hidden group-hover:flex'
              }`}
              title={task.today ? t('tasks.removeFromToday', 'Remove from today plan') : t('tasks.addToToday', 'Add to today plan')}
            >
              {task.today ? (
              <CalendarDaysIcon className="h-3 w-3" />
              ) : (
              <CalendarIcon className="h-3 w-3" />
              )}
              {Number(task.today_move_count) > 1 && (
              <span className="ml-1 text-xs font-medium">
                {Number(task.today_move_count)}
              </span>
              )}
            </button>
          )}
          
          {/* Play/In Progress Controls */}
          {(task.status === 'not_started' || task.status === 'in_progress' || task.status === 0 || task.status === 1) && (
            <button
              onClick={handlePlayToggle}
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                (task.status === 'in_progress' || task.status === 1)
                  ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 animate-pulse'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
              }`}
              title={(task.status === 'in_progress' || task.status === 1) ? t('tasks.setNotStarted', 'Set to not started') : t('tasks.setInProgress', 'Set in progress')}
            >
              <PlayIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile view (below md breakpoint) */}
      <div className="block md:hidden">
        {/* Task Name with Priority Icon and Project Name */}
        <div className="flex items-start font-light text-md text-gray-900 dark:text-gray-100">
          {/* Priority Icon */}
          <TaskPriorityIcon priority={task.priority} status={task.status} onToggleCompletion={onToggleCompletion} />

          {/* Task Title and Project Name */}
          <div className="ml-2 flex flex-col flex-1">
            {/* Task Title */}
            <span>{task.name}</span>

            {/* Project and tags in same row, with spacing when both exist */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              {project && !hideProjectName && (
                <div className="flex items-center">
                  <FolderIcon className="h-3 w-3 mr-1" />
                  <span>{project.name}</span>
                </div>
              )}
              {project && !hideProjectName && task.tags && task.tags.length > 0 && (
                <span className="mx-2">•</span>
              )}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center">
                  <TagIcon className="h-3 w-3 mr-1" />
                  <span>{task.tags.map(tag => tag.name).join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile badges row */}
        <div className="flex items-center flex-wrap justify-start space-x-2 mt-2 ml-8">
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskRecurrenceBadge recurrenceType={task.recurrence_type || 'none'} />
          <TaskStatusBadge status={task.status} />
          
          {/* Play/In Progress Controls - Mobile */}
          {(task.status === 'not_started' || task.status === 'in_progress' || task.status === 0 || task.status === 1) && (
            <button
              onClick={handlePlayToggle}
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                (task.status === 'in_progress' || task.status === 1)
                  ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 animate-pulse'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
              }`}
              title={(task.status === 'in_progress' || task.status === 1) ? t('tasks.setNotStarted', 'Set to not started') : t('tasks.setInProgress', 'Set in progress')}
            >
              <PlayIcon className="h-3 w-3" />
            </button>
          )}

          {/* Today Plan Controls - Mobile */}
          {onToggleToday && (
            <button
              onClick={handleTodayToggle}
              className={`items-center justify-center ${task.today_move_count && task.today_move_count > 1 ? 'px-2 h-6' : 'w-6 h-6'} rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                task.today 
                  ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 flex'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hidden group-hover:flex'
              }`}
              title={task.today ? t('tasks.removeFromToday', 'Remove from today plan') : t('tasks.addToToday', 'Add to today plan')}
            >
              {task.today ? (
                <CalendarDaysIcon className="h-3 w-3" />
              ) : (
                <CalendarIcon className="h-3 w-3" />
              )}
              {task.today_move_count && task.today_move_count > 1 && (
                <span className="ml-1 text-xs font-medium">
                  {task.today_move_count}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskHeader;
