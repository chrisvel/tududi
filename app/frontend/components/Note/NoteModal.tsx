import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../../entities/Note';
import { useDataContext } from '../../contexts/DataContext';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  onSave: (noteData: Note) => void;
}

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, note, onSave }) => {
  const { createNote, updateNote } = useDataContext();
  const [formData, setFormData] = useState<Note>({
    id: note?.id || 0,
    title: note?.title || '',
    content: note?.content || '',
    tags: note?.tags || [],
  });
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        id: note?.id || 0,
        title: note?.title || '',
        content: note?.content || '',
        tags: note?.tags || [],
      });
      setError(null);
    }
  }, [isOpen, note]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Note title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (formData.id && formData.id !== 0) {
        await updateNote(formData.id, formData);
      } else {
        await createNote(formData);
      }
      handleClose();
    } catch (err) {
      setError((err as Error).message);
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={`bg-white dark:bg-gray-800 w-full sm:max-w-2xl mx-auto overflow-hidden h-screen sm:h-auto flex flex-col transform transition-transform duration-300 ${
            isClosing ? 'scale-95' : 'scale-100'
          } sm:rounded-lg sm:shadow-2xl`}
          style={{
            maxHeight: 'calc(100vh - 4rem)',
          }}
        >
          <form className="flex flex-col flex-1" onSubmit={handleSubmit}>
            <fieldset className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Note Title */}
              <div>
                <label
                  htmlFor="noteTitle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="noteTitle"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter note title"
                />
              </div>

              {/* Note Content */}
              <div className="flex-1">
                <label
                  htmlFor="noteContent"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Content
                </label>
                <textarea
                  id="noteContent"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows={10}
                  className="mt-1 block w-full h-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter note content"
                ></textarea>
              </div>

              {/* Error Message */}
              {error && <div className="text-red-500">{error}</div>}
            </fieldset>

            {/* Modal Actions */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 mr-2 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : formData.id && formData.id !== 0
                  ? 'Update Note'
                  : 'Create Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default NoteModal;
