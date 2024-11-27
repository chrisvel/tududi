import React, { useState, useEffect, useRef, useCallback } from "react";
import { Area } from "../../entities/Area";
import { Project } from "../../entities/Project";
import ConfirmDialog from "../Shared/ConfirmDialog";
import { useToast } from "../Shared/ToastContext";
import TagInput from "../Tag/TagInput";
import useFetchTags from "../../hooks/useFetchTags";
import PriorityDropdown from "../Shared/PriorityDropdown";
import { PriorityType } from "../../entities/Task";
import Switch from "../Shared/Switch";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  onDelete?: (projectId: number) => void;
  project?: Project;
  areas: Area[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  project,
  areas,
}) => {
  const [formData, setFormData] = useState<Project>(
    project || {
      name: "",
      description: "",
      area_id: null,
      active: true,
      tags: [],
      priority: "low",
    }
  );

  const [tags, setTags] = useState<string[]>(
    project?.tags?.map((tag) => tag.name) || []
  );

  const {
    tags: availableTags,
    isLoading: isTagsLoading,
    isError: isTagsError,
  } = useFetchTags();

  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { showSuccessToast, showErrorToast } = useToast();

  useEffect(() => {
    if (project) {
      setFormData({
        ...project,
        tags: project.tags || [],
      });
      setTags(project.tags?.map((tag) => tag.name) || []);
    } else {
      setFormData({
        name: "",
        description: "",
        area_id: null,
        active: true,
        tags: [],
      });
      setTags([]);
    }
  }, [project]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const target = e.target;
    const { name, type, value } = target;

    if (type === "checkbox") {
      if (target instanceof HTMLInputElement) {
        const checked = target.checked;
        setFormData((prev) => ({
          ...prev,
          [name]: checked,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map((name) => ({ name })) });
    showSuccessToast(
      project
        ? "Project updated successfully!"
        : "Project created successfully!"
    );
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (project && project.id && onDelete) {
      onDelete(project.id);
      showSuccessToast("Project deleted successfully!");
      setShowConfirmDialog(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleToggleActive = () => {
    setFormData((prev) => ({
      ...prev,
      active: !prev.active,
    }));
  };

  if (!isOpen) return null;

  if (isTagsLoading) {
    return (
      <div className="fixed top-16 left-0 right-0 bottom-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          Loading tags...
        </div>
      </div>
    );
  }

  if (isTagsError) {
    return (
      <div className="fixed top-16 left-0 right-0 bottom-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          Error loading tags.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal Overlay */}
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className={`bg-white dark:bg-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl overflow-hidden transform transition-transform duration-300 ${
            isClosing ? "scale-95" : "scale-100"
          } h-screen sm:h-auto flex flex-col`}
          style={{
            maxHeight: "calc(100vh - 4rem)",
          }}
        >
          {/* Form */}
          <form className="flex flex-col flex-1">
            <fieldset className="flex flex-col flex-1">
              {/* Form Fields */}
              <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto">
                {/* Project Name */}
                <div className="py-4">
                  <input
                    type="text"
                    id="projectName"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                    placeholder="Enter project name"
                  />
                </div>

                {/* Description */}
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="projectDescription"
                    name="description"
                    rows={4}
                    value={formData.description || ""}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                    placeholder="Enter project description (optional)"
                  ></textarea>
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Priority
                  </label>
                  <PriorityDropdown
                    value={formData.priority || "medium"}
                    onChange={(value: PriorityType) =>
                      setFormData({ ...formData, priority: value })
                    }
                  />
                </div>

                {/* Tags */}
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <div className="w-full">
                    <TagInput
                      onTagsChange={handleTagsChange}
                      initialTags={tags}
                      availableTags={availableTags}
                    />
                  </div>
                </div>

                {/* Area */}
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Area (optional)
                  </label>
                  <select
                    id="projectArea"
                    name="area_id"
                    value={formData.area_id || ""}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  >
                    <option value="">No Area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center">
                  <Switch
                    isChecked={formData.active}
                    onToggle={handleToggleActive}
                  />
                  <label
                    htmlFor="active"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    Active
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                {project && onDelete && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 focus:outline-none transition duration-150 ease-in-out"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out"
                >
                  {project ? "Update Project" : "Create Project"}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog for Deletion */}
      {showConfirmDialog && (
        <ConfirmDialog
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
};

export default ProjectModal;
