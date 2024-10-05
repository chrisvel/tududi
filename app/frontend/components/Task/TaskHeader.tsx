import React, { useState, useRef, useEffect } from 'react';
import TaskPriorityIcon from './TaskPriorityIcon';
import TaskTags from './TaskTags';
import TaskStatusBadge from './TaskStatusBadge';
import TaskDueDate from './TaskDueDate';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskHeaderProps {
  task: Task;
  project?: Project;
  isEditingTitle: boolean;
  setIsEditingTitle: (isEditing: boolean) => void;
  formData: Task;
  setFormData: React.Dispatch<React.SetStateAction<Task>>;
  onTaskUpdate: (task: Task) => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  task,
  project,
  isEditingTitle,
  setIsEditingTitle,
  formData,
  setFormData,
  onTaskUpdate,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    inputRef.current?.focus();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      name: e.target.value,
    }));
  };

  const handleTitleBlur = () => {
    onTaskUpdate({ ...task, name: formData.name });
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onTaskUpdate({ ...task, name: formData.name });
      setIsEditingTitle(false);
    }
  };

  // Remove dynamic width calculation
  // const titleWidth = isEditingTitle ? Math.max(formData.name.length * 10, 150) : 'auto';

  return (
    <div className="flex items-center justify-between py-2 px-4 cursor-pointer">
      <div className="flex items-center flex-grow space-x-4">
        <TaskPriorityIcon priority={task.priority} status={task.status} />

        <div className="flex flex-col justify-center" style={{ flexGrow: 1 }}>
          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={formData.name}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="font-medium text-sm text-gray-800 border-b focus:outline-none focus:border-blue-500 w-full"
            />
          ) : (
            <div onClick={handleTitleClick} className="w-full">
              <span className="font-medium text-sm text-gray-800">{task.name}</span>
              {project && <div className="text-xs text-gray-500">{project.name}</div>}
            </div>
          )}
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
