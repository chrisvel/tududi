import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import TagInput from '../../TagInput';
import TaskActions from './TaskActions';

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
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
  projects,
}) => {
  const [formData, setFormData] = useState<Task>(task);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(task.tags?.map(tag => tag.name) || []);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

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

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map(tag => ({ name: tag })) });
    handleClose();
  };

  const handleDelete = () => {
    if (formData.id) {
      onDelete(formData.id);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Match animation duration
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
    <div
      className={`fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-lg mx-auto overflow-hidden transform transition-transform duration-300 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
      >
        <form>
          <fieldset>
            <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              {/* Task Name */}
              <div>
                <label
                  htmlFor={`task_name_${task.id}`}
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Task Name
                </label>
                <input
                  type="text"
                  id={`task_name_${task.id}`}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="+ Add Task"
                />
              </div>

              {/* Tags */}
              <div>
                <label
                  htmlFor={`task_tags_${task.id}`}
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Tags
                </label>
                <TagInput
                  onTagsChange={handleTagsChange}
                  initialTags={formData.tags?.map((tag) => tag.name) || []}
                  availableTags={availableTags}
                />
              </div>

              {/* Project */}
              <div>
                <label
                  htmlFor={`task_project_${task.id}`}
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Project (optional)
                </label>
                <select
                  id={`task_project_${task.id}`}
                  name="project_id"
                  value={formData.project_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">No Project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status, Priority, Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor={`task_status_${task.id}`}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Status
                  </label>
                  <select
                    id={`task_status_${task.id}`}
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`task_priority_${task.id}`}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Priority
                  </label>
                  <select
                    id={`task_priority_${task.id}`}
                    name="priority"
                    value={formData.priority || 'medium'}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`task_due_date_${task.id}`}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Due Date
                  </label>
                  <input
                    type="date"
                    id={`task_due_date_${task.id}`}
                    name="due_date"
                    value={formData.due_date || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label
                  htmlFor={`task_note_${task.id}`}
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Note
                </label>
                <textarea
                  id={`task_note_${task.id}`}
                  name="note"
                  rows={3}
                  value={formData.note || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Add any additional notes here"
                ></textarea>
              </div>
            </div>

            {/* Task Actions */}
            <div className="p-3 border-t dark:border-gray-700">
              <TaskActions
                taskId={task.id}
                onDelete={handleDelete}
                onSave={handleSubmit} // Direct call without event
                onCancel={handleClose}
              />
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
