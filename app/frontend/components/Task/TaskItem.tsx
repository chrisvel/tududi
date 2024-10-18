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
  const [projectList, setProjectList] = useState<Project[]>(projects); // Keep track of projects

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

  // Function to create a new project
  const handleCreateProject = async (name: string): Promise<Project> => {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, active: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      // Update local project list
      setProjectList((prevProjects) => [...prevProjects, newProject]);
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  // Find the project associated with this task
  const project = projectList.find((p) => p.id === task.project_id);

  return (
    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1">
      <TaskHeader task={task} project={project} onTaskClick={handleTaskClick} />

      {/* Task Modal for editing */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={task}
        onSave={handleSave}
        onDelete={onTaskDelete}
        projects={projectList} // Pass updated project list to modal
        onCreateProject={handleCreateProject} // Pass project creation function
      />
    </div>
  );
};

export default TaskItem;
