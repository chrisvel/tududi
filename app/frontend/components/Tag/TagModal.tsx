import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../../entities/Tag';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();

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
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showErrorToast('Tag name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Assuming you have createTag and updateTag functions
      if (tag) {
        // Update existing tag
        // await updateTag(formData.id, formData);
        showSuccessToast('Tag updated successfully!');
      } else {
        // Create new tag
        // await createTag(formData);
        showSuccessToast('Tag created successfully!');
      }
      onSave(formData);
      handleClose();
    } catch (err) {
      showErrorToast('Failed to save tag.');
    } finally {
      setIsSubmitting(false);
    }
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
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md overflow-hidden transform transition-transform duration-300 ${
            isClosing ? 'scale-95' : 'scale-100'
          } h-screen sm:h-auto flex flex-col`}
          style={{
            maxHeight: 'calc(100vh - 4rem)',
          }}
        >
          <form className="flex flex-col flex-1">
            <fieldset className="flex flex-col flex-1">
              <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto">
                {/* Tag Name */}
                <div className="py-4">
                  <input
                    type="text"
                    id="tagName"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                    placeholder="Enter tag name"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : tag ? 'Update Tag' : 'Create Tag'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
    </>
  );
};

export default TagModal;
