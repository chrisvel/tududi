import React from "react";
import TaskPriorityIcon from "./TaskPriorityIcon";
import TaskTags from "./TaskTags";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskDueDate from "./TaskDueDate";
import { Project } from "../../entities/Project";
import { Task } from "../../entities/Task";

interface TaskHeaderProps {
  task: Task;
  project?: Project;
  onTaskClick: (e: React.MouseEvent) => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ task, project, onTaskClick }) => {
  const capitalizeFirstLetter = (string: string | undefined) => {
    if (!string) {
      return '';
    }
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <div className="py-4 px-4 cursor-pointer" onClick={onTaskClick}>
      {/* Full view (md and larger) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4 mb-2 md:mb-0">
          <TaskPriorityIcon priority={task.priority} status={task.status} />
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {task.name}
            </span>
            {project && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {project.name}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-start md:justify-end space-x-1">
          {/* Tags without onTagRemove prop */}
          <TaskTags tags={task.tags || []} />
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskStatusBadge status={task.status} />
        </div>
      </div>

      {/* Mobile view (below md breakpoint) */}
      <div className="block md:hidden"> {/* Add bottom margin */}
        <div className="font-medium text-lg text-gray-900 dark:text-gray-100 mb-4">
          {/* Increase text size from text-sm to text-base */}
          {task.name}
        </div>

        <div className="flex items-center mb-2">
          <TaskPriorityIcon priority={task.priority} status={task.status} />
          <span className="ml-2 text-sm">{capitalizeFirstLetter(task.priority)}</span> {/* Increase text size */}
        </div>

        <div className="flex items-center mb-2">
          <TaskStatusBadge status={task.status} />
          <span className="ml-2 text-sm"></span> {/* Increase text size */}
        </div>

        {task.due_date && (
          <div className="flex items-center mb-2">
            <i className="bi bi-clock mr-2"></i>
            <TaskDueDate dueDate={task.due_date} />
          </div>
        )}

        {/* Tags without onTagRemove prop */}
        <div className="flex items-center">
          <i className="bi bi-tag mr-2"></i>
          <div className="flex-1 flex-wrap overflow-hidden">
            <TaskTags tags={task.tags || []} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskHeader;
