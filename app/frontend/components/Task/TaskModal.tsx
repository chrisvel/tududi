import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import TagInput from '../../TagInput';
import TaskActions from './TaskActions';
import PriorityDropdown from '../Shared/PriorityDropdown';
import StatusDropdown from '../Shared/StatusDropdown';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useToast } from '../Shared/ToastContext'; // Import the toast hook

interface Tag {
  id?: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
}

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
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(task.tags?.map(tag => tag.name) || []);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // State to control confirm dialog

  const { showSuccessToast, showErrorToast } = useToast(); // Use toast functions

  useEffect(() => {
    setFormData(task);
    setTags(task.tags?.map(tag => tag.name) || []);
  }, [task]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/tags')
        .then((response) => response.json())
        .then((data) => setAvailableTags(data.map((tag: Tag) => tag.name)))
        .catch((error) => console.error('Failed to fetch tags', error));
    }
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
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
    if (newProjectName.trim() !== '') {
      setIsCreatingProject(true);
      try {
        const newProject = await onCreateProject(newProjectName);
        setFormData({ ...formData, project_id: newProject.id });
        setFilteredProjects([...filteredProjects, newProject]);
        setNewProjectName(newProject.name);
        setDropdownOpen(false);
        showSuccessToast('Project created successfully!');
      } catch (error) {
        showErrorToast('Failed to create project.');
        console.error('Error creating project:', error);
      } finally {
        setIsCreatingProject(false);
      }
    }
  };

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map(tag => ({ name: tag })) });
    showSuccessToast('Task updated successfully!');
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true); // Show confirmation dialog
  };

  const handleDeleteConfirm = () => {
    if (formData.id) {
      onDelete(formData.id);
      showSuccessToast('Task deleted successfully!');
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50 transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div
          ref={modalRef}
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl w-full max-w-3xl mx-auto overflow-hidden transform transition-transform duration-300 ${
            isClosing ? 'scale-95' : 'scale-100'
          }`}
          style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <form>
            <fieldset>
              <div className="p-4 space-y-3 flex-grow text-sm">
                {/* Task Name */}
                <div className="py-4">
                  <input
                    type="text"
                    id={`task_name_${task.id}`}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full text-xl font-semibold border-none focus:outline-none shadow-sm py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
                    placeholder="Add Task Name"
                  />
                </div>

                {/* Tags */}
                <div className="pb-3">
                  <label
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Tags
                  </label>
                  <div className="w-full">
                    <TagInput
                      onTagsChange={handleTagsChange}
                      initialTags={formData.tags?.map((tag) => tag.name) || []}
                      availableTags={availableTags}
                    />
                  </div>
                </div>

                {/* Project */}
                <div className="pb-3">
                  <label
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3"
                  >
                    Project
                  </label>
                  <input
                    type="text"
                    placeholder="Search or create a project..."
                    value={newProjectName}
                    onChange={handleProjectSearch}
                    className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  {dropdownOpen && newProjectName && (
                    <div className="absolute mt-1 bg-white dark:bg-gray-900 shadow-md rounded-md w-full z-10">
                      {filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleProjectSelection(project)}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {project.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-gray-500 dark:text-gray-300">
                          No matching projects
                        </div>
                      )}
                      {newProjectName && (
                        <button
                          type="button"
                          onClick={handleCreateProject}
                          disabled={isCreatingProject}
                          className="block w-full text-left px-4 py-2 bg-blue-500 text-white hover:bg-blue-600"
                        >
                          {isCreatingProject ? 'Creating...' : `+ Create "${newProjectName}"`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Status and Priority */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Status
                    </label>
                    <StatusDropdown
                      value={formData.status}
                      onChange={(value) => setFormData({ ...formData, status: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Priority
                    </label>
                    <PriorityDropdown
                      value={formData.priority || 'medium'}
                      onChange={(value) => setFormData({ ...formData, priority: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Due Date
                    </label>
                    <input
                      type="date"
                      id={`task_due_date_${task.id}`}
                      name="due_date"
                      value={formData.due_date || ''}
                      onChange={handleChange}
                      className="block w-full focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-900 rounded-md text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Note
                  </label>
                  <textarea
                    id={`task_note_${task.id}`}
                    name="note"
                    rows={3}
                    value={formData.note || ''}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm p-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Add any additional notes here"
                  ></textarea>
                </div>
              </div>

              {/* Task Actions */}
              <div className="p-3 border-t dark:border-gray-700">
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
          title="Delete Task"
          message="Are you sure you want to delete this task? This action cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
};

export default TaskModal;
