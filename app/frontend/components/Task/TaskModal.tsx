import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import TagInput from '../../TagInput';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, tags: tags.map(tag => ({ name: tag })) });
    onClose();
  };

  const handleDelete = () => {
    if (formData.id) {
      onDelete(formData.id);
      onClose();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-auto overflow-hidden">
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              {/* Task Name */}
              <div>
                <label htmlFor={`task_name_${task.id}`} className="block text-xs font-medium text-gray-700">
                  Task Name
                </label>
                <input
                  type="text"
                  id={`task_name_${task.id}`}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
                  placeholder="+ Add Task"
                />
              </div>

              {/* Tags */}
              <div>
                <label htmlFor={`task_tags_${task.id}`} className="block text-xs font-medium text-gray-700">
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
                <label htmlFor={`task_project_${task.id}`} className="block text-xs font-medium text-gray-700">
                  Project (optional)
                </label>
                <select
                  id={`task_project_${task.id}`}
                  name="project_id"
                  value={formData.project_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
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
                  <label htmlFor={`task_status_${task.id}`} className="block text-xs font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id={`task_status_${task.id}`}
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`task_priority_${task.id}`} className="block text-xs font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    id={`task_priority_${task.id}`}
                    name="priority"
                    value={formData.priority || 'medium'}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`task_due_date_${task.id}`} className="block text-xs font-medium text-gray-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    id={`task_due_date_${task.id}`}
                    name="due_date"
                    value={formData.due_date || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label htmlFor={`task_note_${task.id}`} className="block text-xs font-medium text-gray-700">
                  Note
                </label>
                <textarea
                  id={`task_note_${task.id}`}
                  name="note"
                  rows={3}
                  value={formData.note || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
                  placeholder="Add any additional notes here"
                ></textarea>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 border-t">
              {task.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center px-3 py-1.5 text-xs text-white bg-red-500 rounded hover:bg-red-600"
                >
                  <i className="bi bi-trash mr-2"></i> Delete
                </button>
              )}
              <div className="ml-auto flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {task.id ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
