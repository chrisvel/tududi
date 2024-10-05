import React, { useCallback } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TagInput from '../../TagInput';

interface TaskFormProps {
  formData: Task;
  setFormData: (data: Task) => void;
  availableTags: string[];
  tags: string[];
  handleTagsChange: (newTags: string[]) => void;
  projects: Project[];
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}

const TaskForm: React.FC<TaskFormProps> = ({
  formData,
  setFormData,
  availableTags,
  tags,
  handleTagsChange,
  projects,
  handleChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Tags</label>
        <TagInput
          onTagsChange={handleTagsChange}
          initialTags={tags}
          availableTags={availableTags}
        />
      </div>

      {/* Project */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Project (optional)</label>
        <select
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

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Status</label>
        <select
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

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Priority</label>
        <select
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

      {/* Due Date */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Due Date</label>
        <input
          type="date"
          name="due_date"
          value={formData.due_date || ''}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
        />
      </div>

      {/* Note */}
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-gray-700">Note</label>
        <textarea
          name="note"
          rows={3}
          value={formData.note || ''}
          onChange={handleChange}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1.5 text-sm"
          placeholder="Add any additional notes here"
        ></textarea>
      </div>
    </div>
  );
};

export default TaskForm;
