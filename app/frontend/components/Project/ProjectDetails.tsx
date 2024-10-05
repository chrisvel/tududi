// ProjectDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import NewTask from '../../NewTask';
import TaskList from '../Task/TaskList';

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { title: stateTitle, icon: stateIcon } = location.state || {};
  const projectTitle = stateTitle || project?.name || 'Project';
  const projectIcon = stateIcon || 'bi-folder-fill';

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/project/${id}`);
        const data = await response.json();
        if (response.ok) {
          setProject(data);
          setTasks(data.tasks || []);
        } else {
          throw new Error(data.error || 'Failed to fetch project.');
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        if (response.ok) {
          setProjects(data.projects || []);
        } else {
          throw new Error(data.error || 'Failed to fetch projects.');
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };
    fetchProjects();
  }, []);

  const handleTaskCreate = async (taskData: Task) => {
    try {
      const response = await fetch('/api/task/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, project_id: project?.id }),
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks((prevTasks) => [newTask, ...prevTasks]);
      } else {
        throw new Error('Failed to create task.');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Error creating task.');
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const response = await fetch(`/api/task/${updatedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });

      if (response.ok) {
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        );
      } else {
        throw new Error('Failed to update task.');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Error updating task.');
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const response = await fetch(`/api/task/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      } else {
        throw new Error('Failed to delete task.');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Error deleting task.');
    }
  };

  if (loading) {
    return <div>Loading project...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      {/* Project Title and Icon */}
      <div className="flex items-center mb-4">
        <i className={`bi ${projectIcon} text-xl mr-2`}></i>
        <h2 className="text-2xl font-light">{projectTitle}</h2>
      </div>
      
      {project?.description && <p className="text-gray-700 mb-4">{project.description}</p>}

      {/* New Task Form */}
      <NewTask
        onTaskCreate={(taskName: string) =>
          handleTaskCreate({ name: taskName, status: 'not_started', project_id: project?.id })
        }
      />

      {/* Task List */}
      <TaskList
        tasks={tasks}
        onTaskCreate={handleTaskCreate}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        projects={projects}
      />
    </div>
  );
};

export default ProjectDetails;
