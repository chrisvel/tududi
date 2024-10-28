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
  onTaskClick: (e: React.MouseEvent) => void; // For opening the modal
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ task, project, onTaskClick }) => {
  return (
    <div className="py-2 px-4 cursor-pointer" onClick={onTaskClick}>
      {/* Full view (md and larger) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
        {/* First Line (Task Priority, Name, and Project) */}
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

        {/* Second Line (Tags, Due Date, Status) */}
        <div className="flex items-center flex-wrap justify-start md:justify-end space-x-4">
          <TaskTags tags={task.tags || []} onTagRemove={() => {}}/>
          {task.due_date && <TaskDueDate dueDate={task.due_date} />}
          <TaskStatusBadge status={task.status} />
        </div>
      </div>

      {/* Mobile view (below md breakpoint) */}
      <div className="block md:hidden">
        {/* First Line (Priority Icon and Task Title) */}
        <div className="flex items-center mb-2">
          <TaskPriorityIcon priority={task.priority} status={task.status} />
          <span className="ml-2 font-medium text-sm text-gray-900 dark:text-gray-100">
            {task.name}
          </span>
        </div>

        {/* Second Line (Status Icon and Due Date) */}
        <div className="flex items-center mb-2 pl-6">
          <TaskStatusBadge status={task.status}  />
          {task.due_date && (
            <TaskDueDate dueDate={task.due_date} className="ml-2" />
          )}
        </div>

        {/* Third Line (Tags, indented) */}
        <div className="pl-6">
          <TaskTags tags={task.tags || []} onTagRemove={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default TaskHeader;
