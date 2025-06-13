import React, { useState, useEffect, useRef, useCallback } from "react";
import { PriorityType, StatusType, Task } from "../../entities/Task";
import TaskActions from "./TaskActions";
import PriorityDropdown from "../Shared/PriorityDropdown";
import StatusDropdown from "../Shared/StatusDropdown";
import ConfirmDialog from "../Shared/ConfirmDialog";
import { useToast } from "../Shared/ToastContext";
import TagInput from "../Tag/TagInput";
import { Project } from "../../entities/Project";
import { useStore } from "../../store/useStore";
import { fetchTags } from '../../utils/tagsService';
import { useTranslation } from "react-i18next";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (task: Task) => void;
  onDelete: (taskId: number) => void;
  projects: Project[];
  onCreateProject: (name: string) => Promise<Project>;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
  projects,
  onCreateProject,
}) => {
  const [formData, setFormData] = useState<Task>(task);
  const [tags, setTags] = useState<string[]>(task.tags?.map((tag) => tag.name) || []);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [localAvailableTags, setLocalAvailableTags] = useState<Array<{name: string}>>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setFormData(task);
    setTags(task.tags?.map((tag) => tag.name) || []);
    
    const currentProject = projects.find((project) => project.id === task.project_id);
    setNewProjectName(currentProject ? currentProject.name : '');
  }, [task, projects]);

  useEffect(() => {
    const loadTags = async () => {
      if (isOpen && !tagsLoaded) {
        setTagsLoading(true);
        try {
          const fetchedTags = await fetchTags();
          setLocalAvailableTags(fetchedTags);
          setTagsLoaded(true);
        } catch (error: any) {
          console.error("Error fetching tags:", error);
          setTagsLoaded(true); // Mark as loaded even on error to prevent retry loop
        } finally {
          setTagsLoading(false);
        }
      }
    };

    // Only load tags if modal is open
    if (isOpen) {
      loadTags();
    }
  }, [isOpen, tagsLoaded]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const handleProjectSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setNewProjectName(query);
    setDropdownOpen(true);
    setFilteredProjects(
      projects.filter((project) =>
        project.name.toLowerCase().includes(query)
      )
    );
  };

  const handleProjectSelection = (project: Project) => {
    setFormData({ ...formData, project_id: project.id });
    setNewProjectName(project.name);
    setDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim() !== "") {
      setIsCreatingProject(true);
      try {
        const newProject = await onCreateProject(newProjectName);
        setFormData({ ...formData, project_id: newProject.id });
        setFilteredProjects([...filteredProjects, newProject]);
        setNewProjectName(newProject.name);
        setDropdownOpen(false);
        showSuccessToast("Project created successfully!");
      } catch (error) {
        showErrorToast("Failed to create project.");
        console.error("Error creating project:", error);
      } finally {
        setIsCreatingProject(false);
      }
    }
  };

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map((tag) => ({ name: tag })) });
    showSuccessToast("Task updated successfully!");
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (formData.id) {
      onDelete(formData.id);
      showSuccessToast("Task deleted successfully!");
      setShowConfirmDialog(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setTagsLoaded(false); // Reset tags loaded state for next modal open
    }, 300);
  };

  useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
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

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          ref={modalRef}
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-3xl overflow-hidden transform transition-transform duration-300 ${
            isClosing ? "scale-95" : "scale-100"
          } h-screen sm:h-auto flex flex-col`}
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          <form className="flex flex-col flex-1">
            <fieldset className="flex flex-col flex-1">
              <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto">
                <div className="py-4">
                  <input
                    type="text"
                    id={`task_name_${task.id}`}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                    placeholder={t('forms.task.namePlaceholder', 'Add Task Name')}
                  />
                </div>
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.task.labels.tags', 'Tags')}
                  </label>
                  <div className="w-full">
                    <TagInput
                      onTagsChange={handleTagsChange}
                      initialTags={formData.tags?.map((tag) => tag.name) || []}
                      availableTags={localAvailableTags}
                    />
                  </div>
                </div>
                <div className="pb-3 relative">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('forms.task.labels.project', 'Project')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('forms.task.projectSearchPlaceholder', 'Search or create a project...')}
                    value={newProjectName}
                    onChange={handleProjectSearch}
                    className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  {dropdownOpen && newProjectName && (
                    <div className="absolute mt-1 bg-white dark:bg-gray-900 shadow-md rounded-md w-full z-10">
                      {filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleProjectSelection(project)}
                            className="block w-full text-gray-500 dark:text-gray-300 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {project.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-gray-500 dark:text-gray-300">
                          {t('forms.task.noMatchingProjects', 'No matching projects')}
                        </div>
                      )}
                      {newProjectName && (
                        <button
                          type="button"
                          onClick={handleCreateProject}
                          disabled={isCreatingProject}
                          className="block w-full text-left px-4 py-2 bg-blue-500 text-white hover:bg-blue-600"
                        >
                          {isCreatingProject
                            ? t('forms.task.creatingProject', 'Creating...')
                            : t('forms.task.createProject', '+ Create') + ` "${newProjectName}"`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-3 sm:grid-flow-col">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('forms.task.labels.status', 'Status')}
                    </label>
                    <StatusDropdown
                      value={formData.status}
                      onChange={(value: StatusType) =>
                        setFormData({ ...formData, status: value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('forms.task.labels.priority', 'Priority')}
                    </label>
                    <PriorityDropdown
                      value={formData.priority || "medium"}
                      onChange={(value: PriorityType) =>
                        setFormData({ ...formData, priority: value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('forms.task.labels.dueDate', 'Due Date')}
                    </label>
                    <input
                      type="date"
                      id={`task_due_date_${task.id}`}
                      name="due_date"
                      value={formData.due_date || ""}
                      onChange={handleChange}
                      className="block w-full focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-900 rounded-md text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('forms.noteContent')}
                  </label>
                  <textarea
                    id={`task_note_${task.id}`}
                    name="note"
                    rows={3}
                    value={formData.note || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder={t('forms.noteContentPlaceholder')}
                  ></textarea>
                </div>
              </div>
              <div className="p-3 flex-shrink-0">
                <TaskActions
                  taskId={task.id}
                  onDelete={handleDeleteClick}
                  onSave={handleSubmit}
                  onCancel={handleClose}
                />
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      {showConfirmDialog && (
        <ConfirmDialog
          title={t('modals.deleteTask.title', 'Delete Task')}
          message={t('modals.deleteTask.confirmation', 'Are you sure you want to delete this task? This action cannot be undone.')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
};

export default TaskModal;