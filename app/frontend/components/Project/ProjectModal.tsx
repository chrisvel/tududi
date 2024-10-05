import React, { useState, useEffect, useRef } from 'react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  project?: Project; // Optional, for editing
  areas: Area[];
}

interface Project {
  id?: number;
  name: string;
  description?: string;
  area_id?: number | null;
}

interface Area {
  id: number;
  name: string;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, project, areas }) => {
  const [formData, setFormData] = useState<Project>(
    project || {
      name: '',
      description: '',
      area_id: null,
    }
  );

  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal if clicked outside of it
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

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-auto overflow-hidden">
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="projectDescription"
                  name="description"
                  rows={3}
                  value={formData.description || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                ></textarea>
              </div>

              {/* Area */}
              <div>
                <label htmlFor="projectArea" className="block text-sm font-medium text-gray-700">
                  Area (optional)
                </label>
                <select
                  id="projectArea"
                  name="area_id"
                  value={formData.area_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                >
                  <option value="">No Area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end items-center p-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {project ? 'Update Project' : 'Create Project'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
