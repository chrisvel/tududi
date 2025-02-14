import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  PencilSquareIcon,
  TrashIcon,
  FolderIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import TaskList from "../Task/TaskList";
import ProjectModal from "../Project/ProjectModal";
import ConfirmDialog from "../Shared/ConfirmDialog";
import { useStore } from "../../store/useStore";  // Use useStore instead of useDataContext
import NewTask from "../Task/NewTask";
import { Project } from "../../entities/Project";
import { PriorityType, Task } from "../../entities/Task";

type PriorityStyles = Record<PriorityType, string> & { default: string };

const priorityStyles: PriorityStyles = {
  high: 'bg-red-500',   
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  default: 'bg-gray-400',
};

const ProjectDetails: React.FC = () => {
  const updateTask = useStore((state) => state.tasksStore.update); // Use updateTask from store
  const deleteTask = useStore((state) => state.tasksStore.delete); // Use deleteTask from store
  const updateProject = useStore((state) => state.projectsStore.update); // Assume updateProject is available
  const deleteProject = useStore((state) => state.projectsStore.delete); // Assume deleteProject is available
  
  const areas = useStore((state) => state.areasStore.areas);
  const fetchAllAreas = useStore((state) => state.areasStore.fetchAll);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const projectTitle = project?.name || "Project";
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  useEffect(() => {
    fetchAllAreas(); // Fetch areas when component mounts

    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/project/${id}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = await response.json();
        if (response.ok) {
          setProject(data);
          setTasks(data.tasks || []);
        } else {
          throw new Error(data.error || "Failed to fetch project.");
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, fetchAllAreas]);

  const handleTaskCreate = async (taskName: string) => {
    if (!project || project.id === undefined) {
      console.error("Cannot create task: Project or Project ID is missing");
      return;
    }

    const taskPayload = {
      name: taskName,
      status: "not_started",
      project_id: project.id,
    };

    try {
      const response = await fetch(`/api/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(taskPayload),
      });

      const newTask = await response.json();
      if (response.ok) {
        setTasks([...tasks, newTask]);
      } else {
        throw new Error(newTask.error || "Failed to create task");
      }
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    if (updatedTask.id === undefined) {
      console.error("Cannot update task: Task ID is missing");
      return;
    }
    try {
      await updateTask(updatedTask.id, updatedTask);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task
        )
      );
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const handleTaskDelete = async (taskId: number | undefined) => {
    if (taskId === undefined) {
      console.error("Cannot delete task: Task ID is missing");
      return;
    }
    try {
      await deleteTask(taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleEditProject = () => {
    setIsModalOpen(true);
  };

  const handleSaveProject = async (updatedProject: Project) => {
    if (!updatedProject || updatedProject.id === undefined) {
      console.error("Cannot save project: Project or Project ID is missing");
      return;
    }
  
    try {
      const savedProject = await updateProject(updatedProject.id, updatedProject);
      setProject(savedProject); 
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving project:", err);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || project.id === undefined) {
      console.error("Cannot delete project: Project or Project ID is missing");
      return;
    }

    try {
      await deleteProject(project.id);
      navigate("/projects");
    } catch (err) {
      console.error("Error deleting project:", err);
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

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Project not found.</div>
      </div>
    );
  }

  const activeTasks = tasks.filter(task => task.status !== 'done');
  const completedTasks = tasks.filter(task => task.status === 'done');

  const toggleCompleted = () => {
    setIsCompletedOpen(!isCompletedOpen);
  };

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Project Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <FolderIcon className="h-6 w-6 text-gray-500 mr-2" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100 mr-2">
              {projectTitle}
            </h2>
            {/* Priority Circle placed after the title */}
            {project.priority && (
              <div
                className={`w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${priorityStyles[project.priority] || priorityStyles.default}`}
                title={`Priority: ${priorityLabel(project.priority)}`}
                aria-label={`Priority: ${priorityLabel(project.priority)}`}
              ></div>
            )}
          </div>
          <div className="flex space-x-2">
            {/* Edit Project Button */}
            <button
              onClick={handleEditProject}
              className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>

            {/* Delete Project Button */}
            <button
              onClick={() => setIsConfirmDialogOpen(true)}
              className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Project Area */}
        {project.area && (
          <div className="flex items-center mb-4">
            <Squares2X2Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <Link
              to={`/projects/?area_id=${project.area.id}`}
              className="text-gray-600 dark:text-gray-400 hover:underline"
            >
              {project.area.name.toUpperCase()}
            </Link>
          </div>
        )}

        {/* Project Description */}
        {project.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {project.description}
          </p>
        )}

        {/* New Task Form */}
        <NewTask
          onTaskCreate={handleTaskCreate}
        />

        {/* Active Tasks */}
        <div className="mt-2">
          {activeTasks.length > 0 ? (
            <TaskList
              tasks={activeTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={project ? [project] : []}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No active tasks.</p>
          )}
        </div>

        {/* Collapsible Completed Tasks */}
        <div className="mt-6">
          <button
            onClick={toggleCompleted}
            className="flex items-center justify-between w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md focus:outline-none"
          >
            <span className="text-sm uppercase font-medium">Completed Tasks</span>
            <svg
              className={`w-6 h-6 transform transition-transform duration-200 ${
                isCompletedOpen ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isCompletedOpen && (
            <div className="mt-4">
              {completedTasks.length > 0 ? (
                <TaskList
                  tasks={completedTasks}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={handleTaskDelete}
                  projects={project ? [project] : []}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  No completed tasks.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modals */}
        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProject}
          project={project}
          areas={areas}  // Pass areas from the store
        />

        {/* Confirm Delete Dialog */}
        {isConfirmDialogOpen && (
          <ConfirmDialog
            title="Delete Project"
            message={`Are you sure you want to delete the project "${project.name}"?`}
            onConfirm={handleDeleteProject}
            onCancel={() => setIsConfirmDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

const priorityLabel = (priority: PriorityType) => {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return '';
  }
};

export default ProjectDetails;
