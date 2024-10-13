import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import NewTask from '../../NewTask';
import TaskList from '../Task/TaskList';
import { PencilSquareIcon, TrashIcon, Squares2X2Icon } from '@heroicons/react/24/solid'; // Import icons
import ProjectModal from '../Project/ProjectModal'; // Import the ProjectModal
import ConfirmDialog from '../Shared/ConfirmDialog'; // Import the ConfirmDialog

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
  const [areas, setAreas] = useState<Area[]>([]); // Fetch areas from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false); // For delete confirmation

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

  // Fetch areas, just like in the Projects component
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch areas.');
        }

        const data: Area[] = await response.json();
        setAreas(data);
      } catch (err) {
        console.error('Error fetching areas:', err);
        setError((err as Error).message);
      }
    };

    fetchAreas();
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
    setIsModalOpen(true);
  };

  const handleSaveProject = async (updatedProject: Project) => {
    const url = updatedProject.id ? `/api/project/${updatedProject.id}` : '/api/project';
    const method = updatedProject.id ? 'PATCH' : 'POST'; // Use PATCH for updates

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedProject),
      });

      if (response.ok) {
        const savedProject = await response.json();
        setProject(savedProject);
        setIsModalOpen(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to save project:', errorData);
      }
    } catch (err) {
      console.error('Error saving project:', err);
    }
  };

  // Handle delete project with confirmation
  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      const response = await fetch(`/api/project/${project.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        navigate('/projects');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project.');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <i className={`bi ${projectIcon} text-xl mr-2`}></i>
            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">{projectTitle}</h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleEditProject}
              className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
              aria-label="Edit Project"
              title="Edit Project"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>

            <button
              onClick={() => setIsConfirmDialogOpen(true)} // Show delete confirmation dialog
              className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
              aria-label="Delete Project"
              title="Delete Project"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {project?.area && (
          <div className="flex items-center mb-4">
            <Squares2X2Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <Link
              to={`/area/${project.area.id}`}
              className="text-gray-600 dark:text-gray-400 hover:underline"
            >
              {project.area.name.toUpperCase()}
            </Link>
          </div>
        )}

        {project?.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-6">{project.description}</p>
        )}

        <NewTask
          onTaskCreate={(taskName: string) =>
            handleTaskCreate({ name: taskName, status: 'not_started', project_id: project?.id })
          }
        />

        {/* TaskList is used with the current project and its tasks */}
        <TaskList
          tasks={tasks}
          onTaskCreate={handleTaskCreate}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          projects={[project!]} // Pass project as an array since TaskList expects projects array
        />

        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProject}
          project={project || undefined}
          areas={areas} // Areas fetched directly from API
        />

        {/* Delete Confirmation Dialog */}
        {isConfirmDialogOpen && (
          <ConfirmDialog
            title="Delete Project"
            message={`Are you sure you want to delete the project "${project?.name}"?`}
            onConfirm={handleDeleteProject}
            onCancel={() => setIsConfirmDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
