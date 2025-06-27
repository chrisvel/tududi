import React, { useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  FolderIcon,
  Squares2X2Icon,
  Bars3Icon,
} from "@heroicons/react/24/solid";
import ConfirmDialog from "./Shared/ConfirmDialog";
import ProjectModal from "./Project/ProjectModal";
import { useStore } from "../store/useStore";
import { fetchGroupedProjects, createProject, updateProject, deleteProject } from "../utils/projectsService";
import { fetchAreas } from "../utils/areasService";
import { useTranslation } from "react-i18next";

import { Project } from "../entities/Project";
import { useModalEvents } from "../hooks/useModalEvents";
import { PriorityType } from "../entities/Task";
import { useSearchParams } from "react-router-dom";
import ProjectItem from "./Project/ProjectItem";


const getPriorityStyles = (priority: PriorityType) => {
  switch (priority) {
    case "low":
      return { color: "bg-green-500" };
    case "medium":
      return { color: "bg-yellow-500" };
    case "high":
      return { color: "bg-red-500" };
    default:
      return { color: "bg-gray-500" };
  }
};

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const { areas, setAreas, setLoading: setAreasLoading, setError: setAreasError } = useStore((state) => state.areasStore);
  const { setLoading: setProjectsLoading, setError: setProjectsError } = useStore((state) => state.projectsStore);
  const { isLoading, isError } = useStore((state) => state.projectsStore);

  const [groupedProjects, setGroupedProjects] = useState<Record<string, Project[]>>({});
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get("active") || "all";
  
  // Dispatch global modal events
  useModalEvents(isProjectModalOpen);
  const areaFilter = searchParams.get("area_id") || "";

useEffect(() => {
  const loadAreas = async () => {
    try {
      const areasData = await fetchAreas();
      setAreas(areasData);
    } catch (error) {
      console.error("Failed to fetch areas:", error);
      setAreasError(true);
    }
  };

  loadAreas();
}, []); 

useEffect(() => {
  const loadProjects = async () => {
    try {
      const groupedProjectsData = await fetchGroupedProjects(activeFilter, areaFilter);
      setGroupedProjects(groupedProjectsData);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setProjectsError(true);
    }
  };

  loadProjects();
}, [activeFilter, areaFilter]); 

  const handleSaveProject = async (project: Project) => {
    setProjectsLoading(true);
    try {
      if (project.id) {
        await updateProject(project.id, project);
      } else {
        await createProject(project);
      }
      const groupedProjectsData = await fetchGroupedProjects(activeFilter, areaFilter);
      setGroupedProjects(groupedProjectsData);
    } catch (error) {
      console.error("Error saving project:", error);
      setProjectsError(true);
    } finally {
      setProjectsLoading(false);
      setIsProjectModalOpen(false);
    }
  };


  const handleEditProject = (project: Project) => {
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      if (projectToDelete.id !== undefined) {
        setProjectsLoading(true);
        await deleteProject(projectToDelete.id);
        const groupedProjectsData = await fetchGroupedProjects(activeFilter, areaFilter);
        setGroupedProjects(groupedProjectsData);
      } else {
        console.error("Cannot delete project: ID is undefined.");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setProjectsError(true);
    } finally {
      setProjectsLoading(false);
      setIsConfirmDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const getCompletionPercentage = (project: Project) => {
    // Now the completion percentage comes directly from the backend
    return (project as any).completion_percentage || 0;
  };

  const handleActiveFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newActiveFilter = e.target.value;
    const params = new URLSearchParams(searchParams);

    if (newActiveFilter === "all") {
      params.delete("active");
    } else {
      params.set("active", newActiveFilter);
    }
    setSearchParams(params);
  };

  const handleAreaFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAreaFilter = e.target.value;
    const params = new URLSearchParams(searchParams);

    if (newAreaFilter === "") {
      params.delete("area_id");
    } else {
      params.set("area_id", newAreaFilter);
    }

    setSearchParams(params);
  };

  // Apply search filter to the grouped projects from backend
  const searchFilteredGroupedProjects = Object.keys(groupedProjects).reduce<Record<string, Project[]>>(
    (acc, areaName) => {
      const projectsInArea = groupedProjects[areaName];
      
      // Defensive check: ensure projectsInArea is an array
      if (!Array.isArray(projectsInArea)) {
        console.warn(`Projects for area "${areaName}" is not an array:`, projectsInArea);
        return acc;
      }
      
      const filteredProjects = projectsInArea.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filteredProjects.length > 0) {
        acc[areaName] = filteredProjects;
      }
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          {t('projects.loading')}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{t('projects.error')}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-6xl">
        <div className="flex items-center mb-8">
          <FolderIcon className="h-6 w-6 text-gray-500 mr-2" />
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
            {t('projects.title')}
          </h2>
        </div>

        {/* View Mode and Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-md focus:outline-none ${
                viewMode === "cards"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              aria-label={t("projects.cardViewAriaLabel")}
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>

            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md focus:outline-none ${
                viewMode === "list"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              aria-label={t("projects.listViewAriaLabel")}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="w-full md:w-auto">
              <label
                htmlFor="activeFilter"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('common.status')}
              </label>
              <select
                id="activeFilter"
                value={activeFilter}
                onChange={handleActiveFilterChange}
                className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">{t('projects.filters.active')}</option>
                <option value="false">{t('projects.filters.inactive')}</option>
                <option value="all">{t('projects.filters.all')}</option>
              </select>
            </div>

            <div className="w-full md:w-auto">
              <label
                htmlFor="areaFilter"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('common.area')}
              </label>
              <select
                id="areaFilter"
                value={areaFilter}
                onChange={handleAreaFilterChange}
                className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('projects.filters.allAreas')}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id?.toString()}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <input
              type="text"
              placeholder={t('projects.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {/* Projects Grid/List */}
        <div
          className={`${
            viewMode === "cards"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "flex flex-col space-y-1"
          }`}
        >
          {Object.keys(searchFilteredGroupedProjects).length === 0 ? (
            <div className="text-gray-700 dark:text-gray-300">
              {t('projects.noProjectsFound')}
            </div>
          ) : (
            Object.keys(searchFilteredGroupedProjects).map((areaName) => (
              <React.Fragment key={areaName}>
                <h3 className={`${
                  viewMode === "cards" 
                    ? "col-span-full text-md uppercase font-light text-gray-800 dark:text-gray-200 mb-2 mt-6"
                    : "text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-6 border-b border-gray-300 dark:border-gray-600 pb-2"
                }`}>
                  {areaName}
                </h3>
                {searchFilteredGroupedProjects[areaName].map((project) => {
                  const { color } = getPriorityStyles(project.priority || "low");
                  return (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      viewMode={viewMode}
                      color={color}
                      getCompletionPercentage={() => getCompletionPercentage(project)}
                      activeDropdown={activeDropdown}
                      setActiveDropdown={setActiveDropdown}
                      handleEditProject={handleEditProject}
                      setProjectToDelete={setProjectToDelete}
                      setIsConfirmDialogOpen={setIsConfirmDialogOpen}
                    />
                  );
                })}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {isProjectModalOpen && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => {
            setIsProjectModalOpen(false);
            setProjectToEdit(null);
          }}
          onSave={handleSaveProject}
          project={projectToEdit || undefined}
          areas={areas}
        />
      )}

      {isConfirmDialogOpen && (
        <ConfirmDialog
          title={t('modals.deleteProject.title')}
          message={t('modals.deleteProject.message', { projectName: projectToDelete?.name })}
          onConfirm={handleDeleteProject}
          onCancel={() => setIsConfirmDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default Projects;
