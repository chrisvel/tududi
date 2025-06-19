import React from "react";
import TaskPriorityIcon from "./TaskPriorityIcon";
import TaskTags from "./TaskTags";
import TaskStatusBadge from "./TaskStatusBadge";
import TaskDueDate from "./TaskDueDate";
import TaskRecurrenceBadge from "./TaskRecurrenceBadge";
import { Project } from "../../entities/Project";
import { Task } from "../../entities/Task";

interface TaskHeaderProps {
  task: Task;
  project?: Project;
  onTaskClick: (e: React.MouseEvent) => void;
  onToggleCompletion?: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  task,
  project,
  onTaskClick,
  onToggleCompletion,
}) => {
  const capitalizeFirstLetter = (string: string | undefined) => {
    if (!string) {
      return "";
    }
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <div className="py-2 px-4 cursor-pointer" onClick={onTaskClick}>
      {/* Full view (md and larger) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4 mb-2 md:mb-0">
          <TaskPriorityIcon priority={task.priority} status={task.status} onToggleCompletion={onToggleCompletion} />
          <div className="flex flex-col">
            <span className="text-md text-gray-900 dark:text-gray-100">
              {task.name}
            </span>
            {project && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {project.name}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-start md:justify-end space-x-2">
          {/* Tags without onTagRemove prop */}
          <TaskTags tags={task.tags || []} />
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskRecurrenceBadge recurrenceType={task.recurrence_type || 'none'} />
          <TaskStatusBadge status={task.status} />
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

            {/* Project Name */}
            {project && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {project.name}
              </div>
            )}
          </div>
        </div>

        {/* Mobile badges row */}
        <div className="flex items-center flex-wrap justify-start space-x-2 mt-2 ml-8">
          <TaskTags tags={task.tags || []} />
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskRecurrenceBadge recurrenceType={task.recurrence_type || 'none'} />
          <TaskStatusBadge status={task.status} />
        </div>
      </div>
    </div>
  );
};

export default TaskHeader;
