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
import { fetchProjects, createProject, updateProject, deleteProject } from "../utils/projectsService";
import {  fetchAreas } from "../utils/areasService";

import { Project } from "../entities/Project";
import { PriorityType, StatusType } from "../entities/Task";
import { useSearchParams } from "react-router-dom";
import ProjectItem from "./Project/ProjectItem";

type ProjectTaskCounts = Record<StatusType, number>;

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
  const { areas, setAreas, setLoading: setAreasLoading, setError: setAreasError } = useStore((state) => state.areasStore);
  const { projects, setProjects, setLoading: setProjectsLoading, setError: setProjectsError } = useStore((state) => state.projectsStore);
  const { isLoading, isError } = useStore((state) => state.projectsStore);

  const [taskStatusCounts, setTaskStatusCounts] = useState<Record<number, ProjectTaskCounts>>({});
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get("active") || "all";
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
      const projectsData = await fetchProjects(activeFilter, areaFilter);
      setProjects(projectsData);
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
      const updatedProjects = await fetchProjects(activeFilter, areaFilter);
      setProjects(updatedProjects);
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
        const updatedProjects = await fetchProjects(activeFilter, areaFilter);
        setProjects(updatedProjects);
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

  const getCompletionPercentage = (projectId: number | undefined) => {
    if (!projectId) return 0;
    const taskStatus = taskStatusCounts[projectId] || {
      not_started: 0,
      in_progress: 0,
      done: 0,
      archived: 0,
    };
    const totalTasks = taskStatus.done + taskStatus.not_started + taskStatus.in_progress;
    if (totalTasks === 0) return 0;
    return Math.round((taskStatus.done / totalTasks) * 100);
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

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedProjects = filteredProjects.reduce<Record<string, Project[]>>(
    (acc, project) => {
      const areaName = project.area ? project.area.name : "Uncategorized";
      if (!acc[areaName]) acc[areaName] = [];
      acc[areaName].push(project);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading projects...
        </div>
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

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-6xl">
        <div className="flex items-center mb-8">
          <FolderIcon className="h-6 w-6 text-gray-500 mr-2" />
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
            Projects
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
              aria-label="Card View"
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
              aria-label="List View"
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
                Status
              </label>
              <select
                id="activeFilter"
                value={activeFilter}
                onChange={handleActiveFilterChange}
                className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="w-full md:w-auto">
              <label
                htmlFor="areaFilter"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Area
              </label>
              <select
                id="areaFilter"
                value={areaFilter}
                onChange={handleAreaFilterChange}
                className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Areas</option>
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
              placeholder="Search projects..."
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
          {Object.keys(groupedProjects).length === 0 ? (
            <div className="text-gray-700 dark:text-gray-300">
              No projects found.
            </div>
          ) : (
            Object.keys(groupedProjects).map((areaName) => (
              <React.Fragment key={areaName}>
                {viewMode === "cards" && (
                  <h3 className="col-span-full text-md uppercase font-light text-gray-800 dark:text-gray-200 mb-2 mt-6">
                    {areaName}
                  </h3>
                )}
                {groupedProjects[areaName].map((project) => {
                  const { color } = getPriorityStyles(project.priority || "low");
                  return (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      viewMode={viewMode}
                      color={color}
                      getCompletionPercentage={getCompletionPercentage}
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
