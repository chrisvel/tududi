import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../../entities/Tag';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => void;
  tag?: Tag | null;
}

const TagModal: React.FC<TagModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tag,
}) => {
  const [formData, setFormData] = useState<Tag>(
    tag || {
      name: '',
    }
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (tag) {
      setFormData(tag);
    } else {
      setFormData({
        name: '',
      });
    }
  }, [tag]);

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
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
    handleClose();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div
          ref={modalRef}
          className={`bg-white dark:bg-gray-800 w-full sm:max-w-md mx-auto overflow-hidden h-screen sm:h-auto flex flex-col transform transition-transform duration-300 ${
            isClosing ? 'scale-95' : 'scale-100'
          } sm:rounded-lg sm:shadow-2xl`}
          style={{
            maxHeight: 'calc(100vh - 4rem)',
          }}
        >
          <form className="flex flex-col flex-1" onSubmit={handleSubmit}>
            <fieldset className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tag Name */}
              <div>
                <label
                  htmlFor="tagName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
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
            </fieldset>

            {/* Modal Actions */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ml-2 px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                {tag ? 'Update Tag' : 'Create Tag'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default TagModal;
