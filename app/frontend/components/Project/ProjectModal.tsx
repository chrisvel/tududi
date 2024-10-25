import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  onDelete?: () => void; 
  project?: Project;
  areas: Area[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, onDelete, project, areas }) => {
  const [formData, setFormData] = useState<Project>(
    project || {
      name: '',
      description: '',
      area_id: null,
      active: true,
      pin_to_sidebar: false,
    }
  );

  const modalRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (project) {
      setFormData(project);
    }
  }, [project]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl mx-auto overflow-hidden">
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter project name"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="projectDescription"
                  name="description"
                  rows={3}
                  value={formData.description || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter project description (optional)"
                ></textarea>
              </div>

              {/* Area */}
              <div>
                <label htmlFor="projectArea" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Area (optional)
                </label>
                <select
                  id="projectArea"
                  name="area_id"
                  value={formData.area_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">No Area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Active Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="h-5 w-5 appearance-none border border-gray-300 rounded-md bg-white dark:bg-gray-700 checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>

              {/* Custom Pin to Sidebar Checkbox */}
              {/* <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pin_to_sidebar"
                  name="pin_to_sidebar"
                  checked={formData.pin_to_sidebar}
                  onChange={handleChange}
                  className="h-5 w-5 appearance-none border border-gray-300 rounded-md bg-white dark:bg-gray-700 checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="pin_to_sidebar" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Pin to Sidebar
                </label>
              </div> */}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
              {project && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                >
                  Delete
                </button>
              )}
              <div className={`flex space-x-2 ${!project ? 'ml-auto' : ''}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {project ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
