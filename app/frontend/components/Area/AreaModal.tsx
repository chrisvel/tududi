// src/components/Area/AreaModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area'; // Adjust the path as necessary

interface AreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (area: Area) => void;
  area?: Area | null; // If null, it's for creating a new Area
}

const AreaModal: React.FC<AreaModalProps> = ({ isOpen, onClose, onSave, area }) => {
  const [formData, setFormData] = useState<Area>(
    area || {
      name: '',
      description: '',
    }
  );
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal if clicked outside
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

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Area name is required.');
      return;
    }

    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-auto overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-4 space-y-4">
              {/* Area Name */}
              <div>
                <label
                  htmlFor="areaName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Area Name
                </label>
                <input
                  type="text"
                  id="areaName"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter area name"
                />
              </div>

              {/* Area Description */}
              <div>
                <label
                  htmlFor="areaDescription"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="areaDescription"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter area description"
                />
              </div>

              {/* Error Message */}
              {error && <div className="text-red-500">{error}</div>}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 mr-2 text-xs py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 text-xs py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none"
              >
                {area ? 'Update Area' : 'Create Area'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default AreaModal;
