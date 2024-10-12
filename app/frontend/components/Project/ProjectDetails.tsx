import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import NewTask from '../../NewTask';
import TaskList from '../Task/TaskList';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid'; // Import icons

interface Area {
  id: number;
  name: string;
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

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
        const response = await fetch(`/api/project/${id}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
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
        const response = await fetch('/api/projects', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
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

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const response = await fetch('/api/task/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...taskData, project_id: project?.id }),
        credentials: 'include',
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks((prevTasks) => [newTask, ...prevTasks]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task.');
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(updatedTask),
        credentials: 'include',
      });

      if (response.ok) {
        const returnedTask = await response.json();
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task.id === updatedTask.id ? returnedTask : task))
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task.');
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
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete task.');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Error deleting task.');
    }
  };

  const handleEditProject = () => {
    // Open the project modal for editing
    navigate('/projects', { state: { editProjectId: id } });
  };

  const handleDeleteProject = () => {
    // Functionality to delete the project can be added here
    console.log('Delete project functionality to be implemented.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading project details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Header Section with Icon and Title */}
        <div className="flex items-center mb-8">
          <i className={`bi ${projectIcon} text-xl mr-2`}></i>
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">{projectTitle}</h2>
        </div>

        {/* Project Area */}
        {project?.area && (
          <div className="flex items-center mb-4">
            <i className="bi bi-geo-alt-fill text-xl text-gray-500 dark:text-gray-400 mr-2"></i>
            <Link
              to={`/area/${project.area.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {project.area.name}
            </Link>
          </div>
        )}

        {/* Project Description */}
        {project?.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-6">{project.description}</p>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end mb-4 space-x-2">
          {/* Edit Project Button */}
          <button
            onClick={handleEditProject}
            className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
            aria-label="Edit Project"
            title="Edit Project"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>

          {/* Delete Project Button */}
          <button
            onClick={handleDeleteProject}
            className="text-gray-500 opacity-50 cursor-not-allowed focus:outline-none"
            aria-label="Delete Project"
            title="Delete Project (Disabled)"
            disabled
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>

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
    </div>
  );
};

export default ProjectDetails;
