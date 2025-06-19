import React from 'react';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (task: Task) => void;
  onTaskCreate?: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
  projects: Project[];
  hideProjectName?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  projects,
  hideProjectName = false,
}) => {
  return (
    <div>
      {tasks.length > 0 ? (
        tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onTaskUpdate={onTaskUpdate}
            onTaskDelete={onTaskDelete}
            projects={projects}
            hideProjectName={hideProjectName}
          />
        ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
          No tasks available.
        </p>
      )}
    </div>
  );
};

export default TaskList;
