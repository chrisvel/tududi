// src/components/Project/ProjectDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import NewTask from '../../NewTask';
import TaskList from '../Task/TaskList';

interface Area {
  id: number;
  name: string;
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate(); // Updated for React Router v6

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
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Accept': 'application/json',
          },
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
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Accept': 'application/json',
          },
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ ...taskData, project_id: project?.id }),
        credentials: 'include', // Include cookies for authentication
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(updatedTask),
        credentials: 'include', // Include cookies for authentication
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
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Accept': 'application/json',
        },
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
    // Navigate to the project edit page using navigate()
    navigate(`/project/${id}/edit`);
  };

  const handleDeleteProject = () => {
    // Functionality to delete the project will be implemented later
    // For now, this can be left empty or show a message
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
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        {/* Project Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {/* Project Icon */}
            <i className={`bi ${projectIcon} text-3xl mr-4`}></i>
            {/* Project Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {projectTitle}
            </h2>
          </div>
          <div className="flex space-x-4">
            {/* Edit Project Button */}
            <button
              onClick={handleEditProject}
              className="text-blue-500 hover:text-blue-700 focus:outline-none"
              aria-label="Edit Project"
              title="Edit Project"
            >
              <i className="bi bi-pencil-square text-2xl"></i>
            </button>

            {/* Delete Project Button */}
            <button
              onClick={handleDeleteProject}
              className="text-red-500 hover:text-red-700 focus:outline-none opacity-50 cursor-not-allowed"
              aria-label="Delete Project"
              title="Delete Project (Disabled)"
              disabled
            >
              <i className="bi bi-trash text-2xl"></i>
            </button>
          </div>
        </div>

        {/* Project Area */}
        {project?.area && (
          <div className="flex items-center mb-4">
            {/* Area Icon */}
            <i className="bi bi-geo-alt-fill text-xl text-gray-500 dark:text-gray-400 mr-2"></i>
            {/* Area Name with Link */}
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
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {project.description}
          </p>
        )}

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
