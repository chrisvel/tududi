import React, { useState } from 'react';
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
  const [projectList, setProjectList] = useState<Project[]>(projects);

  const handleTaskClick = () => {
    setIsModalOpen(true);
  };

  const handleSave = (updatedTask: Task) => {
    onTaskUpdate(updatedTask);
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (task.id) {
      onTaskDelete(task.id);
    }
  };

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
      setProjectList((prevProjects) => [...prevProjects, newProject]);
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const project = projectList.find((p) => p.id === task.project_id);

  return (
    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1">
      <TaskHeader task={task} project={project} onTaskClick={handleTaskClick} />

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={task}
        onSave={handleSave}
        onDelete={handleDelete}
        projects={projectList}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};

export default TaskItem;
