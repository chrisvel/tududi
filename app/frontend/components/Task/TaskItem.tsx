import React, { useState, useEffect } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import TaskModal from './TaskModal';

interface TaskItemProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
  projects: Project[];
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onTaskUpdate,
  onTaskDelete,
  projects,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTaskClick = () => {
    setIsModalOpen(true); // Open the modal when task title is clicked
  };

  const handleSave = (updatedTask: Task) => {
    onTaskUpdate(updatedTask); // Save the updated task
    setIsModalOpen(false); // Close the modal after saving
  };

  const handleDelete = () => {
    if (task.id) {
      onTaskDelete(task.id); // Delete the task
    }
  };

  // Find the project associated with this task
  const project = projects.find((p) => p.id === task.project_id);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
      <TaskHeader task={task} project={project} onTaskClick={handleTaskClick} />

      {/* Task Modal for editing */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={task}
        onSave={handleSave}
        onDelete={onTaskDelete}
        projects={projects}
      />
    </div>
  );
};

export default TaskItem;
