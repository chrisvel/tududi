import React, { useState } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import TaskModal from './TaskModal';
import { toggleTaskCompletion } from '../../utils/tasksService';
import { isTaskOverdue } from '../../utils/dateUtils';
import { useModalEvents } from '../../hooks/useModalEvents';

interface TaskItemProps {
  task: Task;
  onTaskUpdate: (task: Task) => Promise<void>;
  onTaskDelete: (taskId: number) => void;
  projects: Project[];
  hideProjectName?: boolean;
  onToggleToday?: (taskId: number) => Promise<void>;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onTaskUpdate,
  onTaskDelete,
  projects,
  hideProjectName = false,
  onToggleToday,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectList, setProjectList] = useState<Project[]>(projects);
  
  // Dispatch global modal events
  useModalEvents(isModalOpen);

  const handleTaskClick = () => {
    setIsModalOpen(true);
  };

  const handleSave = async (updatedTask: Task) => {
    await onTaskUpdate(updatedTask);
    setIsModalOpen(false);
  };
  
  const handleDelete = async (taskId: number) => {
    if (task.id) {
      await onTaskDelete(task.id);
    }
  };

  const handleToggleCompletion = async () => {
    if (task.id) {
      try {
        const updatedTask = await toggleTaskCompletion(task.id);
        await onTaskUpdate(updatedTask);
      } catch (error) {
      }
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
      throw error;
    }
  };

  // Use the project from the task's included data if available, otherwise find from projectList
  const project = task.Project || projectList.find((p) => p.id === task.project_id);

  // Check if task is in progress to apply pulsing border animation
  const isInProgress = task.status === 'in_progress' || task.status === 1;
  
  // Check if task is overdue (created yesterday or earlier and not completed)
  const isOverdue = isTaskOverdue(task);

  return (
    <div 
      className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1 ${
        isInProgress 
          ? 'border-2 border-green-400/60 dark:border-green-500/60' 
          : 'border-2 border-gray-50 dark:border-gray-800'
      }`}
    >
      <TaskHeader 
        task={task} 
        project={project} 
        onTaskClick={handleTaskClick} 
        onToggleCompletion={handleToggleCompletion} 
        hideProjectName={hideProjectName}
        onToggleToday={onToggleToday}
        onTaskUpdate={onTaskUpdate}
        isOverdue={isOverdue}
      />

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
