// src/components/Tag/TagModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../../entities/Tag';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => void;
  tag?: Tag | null;
}

const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose, onSave, tag }) => {
  const [formData, setFormData] = useState<Tag>(
    tag || {
      name: '',
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
    if (tag) {
      setFormData(tag);
    } else {
      setFormData({
        name: '',
      });
    }
  }, [tag]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-auto overflow-hidden">
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Tag Name */}
              <div>
                <label htmlFor="tagName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tag Name
                </label>
                <input
                  type="text"
                  id="tagName"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter tag name"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ml-2 px-3 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                {tag ? 'Update Tag' : 'Create Tag'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default TagModal;
