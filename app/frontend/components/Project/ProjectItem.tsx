import React from "react";
import { Link } from "react-router-dom";
import { EllipsisVerticalIcon } from "@heroicons/react/24/solid";
import { Project } from "../../entities/Project";

interface ProjectItemProps {
  project: Project;
  viewMode: "cards" | "list";
  color: string;
  getCompletionPercentage: (projectId: number | undefined) => number;
  activeDropdown: number | null;
  setActiveDropdown: React.Dispatch<React.SetStateAction<number | null>>;
  handleEditProject: (project: Project) => void;
  setProjectToDelete: React.Dispatch<React.SetStateAction<Project | null>>;
  setIsConfirmDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const getProjectInitials = (name: string) => {
  const words = name
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);
  if (words.length === 1) {
    return name.toUpperCase();
  }
  return words.map((word) => word[0].toUpperCase()).join("");
};

const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  viewMode,
  color,
  getCompletionPercentage,
  activeDropdown,
  setActiveDropdown,
  handleEditProject,
  setProjectToDelete,
  setIsConfirmDialogOpen,
}) => {
  return (
    <div
      className={`${
        viewMode === "cards"
          ? "bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col"
          : "bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-row items-center p-4"
      }`}
      style={{
        minHeight: viewMode === "cards" ? "250px" : "auto",
        maxHeight: viewMode === "cards" ? "250px" : "auto",
      }}
    >
      {viewMode === "cards" && (
        <div
          className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden rounded-t-lg"
          style={{ height: "140px" }}
        >
          <span className="text-2xl font-extrabold text-gray-500 dark:text-gray-400 opacity-20">
            {getProjectInitials(project.name)}
          </span>
          <div
            className={`absolute top-2 left-2 w-3 h-3 rounded-full ${color}`}
          ></div>
        </div>
      )}

      <div
        className={`flex justify-between items-start ${
          viewMode === "cards" ? "p-4 flex-1" : "flex-1"
        }`}
      >
        <Link
          to={`/project/${project.id}`}
          className={`${
            viewMode === "cards"
              ? "text-lg font-semibold text-gray-900 dark:text-gray-100 hover:underline line-clamp-2"
              : "text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
          }`}
        >
          {project.name}
        </Link>
        <div className="relative">
          <button
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none"
            onClick={() =>
              setActiveDropdown(
                activeDropdown === project.id ? null : project.id ?? null
              )
            }
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>

          {activeDropdown === project.id && (
            <div className="absolute right-0 mt-2 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-10">
              <button
                onClick={() => handleEditProject(project)}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setProjectToDelete(project);
                  setIsConfirmDialogOpen(true);
                  setActiveDropdown(null);
                }}
                className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "cards" && (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="flex items-center space-x-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${getCompletionPercentage(project?.id)}%`,
                }}
              ></div>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getCompletionPercentage(project?.id)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectItem;
