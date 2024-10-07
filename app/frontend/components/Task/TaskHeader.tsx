import React from 'react';
import TaskPriorityIcon from './TaskPriorityIcon';
import TaskTags from './TaskTags';
import TaskStatusBadge from './TaskStatusBadge';
import TaskDueDate from './TaskDueDate';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskHeaderProps {
  task: Task;
  project?: Project;
  onTaskClick: (e: React.MouseEvent) => void; // For opening the modal
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ task, project, onTaskClick }) => {
  return (
    <div
      className="flex items-center justify-between py-2 px-4 cursor-pointer"
      onClick={onTaskClick} // Open modal on title click
    >
      <div className="flex items-center flex-grow space-x-4">
        <TaskPriorityIcon priority={task.priority} status={task.status} />

        <div className="flex flex-col justify-center w-full">
          <div className="w-full">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {task.name}
            </span>
            {project && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{project.name}</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <TaskTags tags={task.tags} />
        {task.due_date && <TaskDueDate dueDate={task.due_date} />}
        <TaskStatusBadge status={task.status} />
      </div>
    </div>
  );
};

export default TaskHeader;
