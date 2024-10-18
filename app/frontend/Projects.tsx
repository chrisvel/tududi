import React, { useState, useEffect, useRef } from 'react';
import { Project } from './entities/Project';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './components/Shared/ConfirmDialog';
import ProjectModal from './components/Project/ProjectModal';
import { useDataContext } from './contexts/DataContext'; // Use the DataContext

interface Area {
  id: number;
  name: string;
}

const Projects: React.FC = () => {
  const {
    projects,
    areas,
    createProject,
    updateProject,
    deleteProject,
    isLoading,
    isError,
    mutateProjects,  // Fetching/mutating projects
  } = useDataContext();

  const [taskStatusCounts, setTaskStatusCounts] = useState<Record<number, any>>({});
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Parse query parameters from URL
  const params = new URLSearchParams(location.search);
  const initialActiveFilter = params.get('active') || 'true';
  const initialAreaFilter = params.get('area_id') || '';

  const [activeFilter, setActiveFilter] = useState<string>(initialActiveFilter);
  const [areaFilter, setAreaFilter] = useState<string>(initialAreaFilter);

  const hasMounted = useRef(false);

  // Update URL and refetch data when filters change, after initial mount
  useEffect(() => {
    if (hasMounted.current) {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.append('active', activeFilter);
      if (areaFilter) params.append('area_id', areaFilter);

      navigate(`/projects?${params.toString()}`, { replace: true });
      mutateProjects();  // Refetch projects when filters change
    } else {
      hasMounted.current = true;
    }
  }, [activeFilter, areaFilter, navigate, mutateProjects]);

  // Calculate the completion percentage for the project
  const getCompletionPercentage = (projectId: number) => {
    const taskStatus = taskStatusCounts[projectId] || {};
    const totalTasks = taskStatus.done + taskStatus.not_started + taskStatus.in_progress || 0;

    if (totalTasks === 0) return 0;

    return Math.round((taskStatus.done / totalTasks) * 100);
  };

  // Handle project save (either create or update)
  const handleSaveProject = async (project: Project) => {
    if (project.id) {
      await updateProject(project.id, project);
    } else {
      await createProject(project);
    }
    setIsProjectModalOpen(false);
    mutateProjects();  // Refetch projects after save
  };

  // Open edit modal and populate form data
  const handleEditProject = (project: Project) => {
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  // Handle delete project
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete.id);
    setIsConfirmDialogOpen(false);
    setProjectToDelete(null);
    mutateProjects();  // Refetch projects after delete
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">Loading projects...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Error loading projects.</div>
      </div>
    );
  }

  // Group projects by area
  const groupedProjects = projects.reduce<Record<string, Project[]>>((acc, project) => {
    const areaName = project.area ? project.area.name : 'Uncategorized';
    if (!acc[areaName]) acc[areaName] = [];
    acc[areaName].push(project);
    return acc;
  }, {});

  return (
    <div className="flex justify-center px-4"> 
      <div className="w-full max-w-4xl"> 
        <div className="flex items-center mb-8">
          <i className="bi bi-folder-fill text-xl mr-2"></i>
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">Projects</h2>
        </div>

        {/* Filters for Active Status and Area */}
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-6">
          <div className="mb-4 md:mb-0 w-full md:w-1/3">
            <label htmlFor="activeFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="activeFilter"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="w-full md:w-1/3">
            <label htmlFor="areaFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Area
            </label>
            <select
              id="areaFilter"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Areas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {Object.keys(groupedProjects).map((areaName) => (
            <div key={areaName} className="bg-white dark:bg-gray-900 shadow rounded-lg p-4">
              <ul className="space-y-2">
                {groupedProjects[areaName].map((project) => (
                  <li key={project.id} className="pb-2">
                    <div className="flex justify-between items-center w-full">
                      <Link
                        to={`/project/${project.id}`}
                        className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:underline flex-shrink-0"
                      >
                        {project.name}
                      </Link>

                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-40 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${getCompletionPercentage(project.id)}%` }}
                            ></div>
                          </div>
                          <span
                            className="text-xs text-gray-500 dark:text-gray-400"
                            style={{ width: '32px', textAlign: 'right' }}
                          >
                            {getCompletionPercentage(project.id)}%
                          </span>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditProject(project)}
                            className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                            aria-label={`Edit ${project.name}`}
                            title={`Edit ${project.name}`}
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => {
                              setProjectToDelete(project);
                              setIsConfirmDialogOpen(true);
                            }}
                            className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                            aria-label={`Delete ${project.name}`}
                            title={`Delete ${project.name}`}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Project Modal */}
      {isProjectModalOpen && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          onSave={handleSaveProject}
          project={projectToEdit || undefined}
          areas={areas}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {isConfirmDialogOpen && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete the project "${projectToDelete?.name}"?`}
          onConfirm={handleDeleteProject}
          onCancel={() => setIsConfirmDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default Projects;
