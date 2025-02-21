import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../../entities/Note';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import { Tag } from '../../entities/Tag';
import { fetchTags } from '../../utils/tagsService'; 

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  onSave: (noteData: Note) => Promise<void>;
}

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, note, onSave }) => {
  const [formData, setFormData] = useState<Note>({
    id: note?.id || 0,
    title: note?.title || '',
    content: note?.content || '',
    tags: note?.tags || [],
  });
  const [tags, setTags] = useState<string[]>(note?.tags?.map((tag) => tag.name) || []);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);

  const { showSuccessToast, showErrorToast } = useToast();

  useEffect(() => {
    const loadTags = async () => {
      try {
        const data = await fetchTags();
        setAvailableTags(data);
      } catch (error) {
        console.error('Failed to fetch tags', error);
        showErrorToast('Failed to load available tags.');
      }
    };

    if (isOpen) {
      loadTags();
    }
  }, [isOpen, showErrorToast]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        id: note?.id || 0,
        title: note?.title || '',
        content: note?.content || '',
        tags: note?.tags || [],
      });
      setTags(note?.tags?.map((tag) => tag.name) || []);
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

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Note title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const noteTags: Tag[] = tags.map(tagName => ({ name: tagName }));
      await onSave({ ...formData, tags: noteTags });
      showSuccessToast(formData.id && formData.id !== 0 ? 'Note updated successfully!' : 'Note created successfully!');
      handleClose();
    } catch (err) {
      setError((err as Error).message);
      showErrorToast('Failed to save note.');
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
    <div
      className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl overflow-hidden transform transition-transform duration-300 ${
          isClosing ? 'scale-95' : 'scale-100'
        } h-screen sm:h-auto flex flex-col`}
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <form className="flex flex-col flex-1">
          <fieldset className="flex flex-col flex-1">
            <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto">
              <div className="py-4">
                <input
                  type="text"
                  id="noteTitle"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                  placeholder="Enter note title"
                />
              </div>

              <div className="pb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="w-full">
                  <TagInput
                    onTagsChange={handleTagsChange}
                    initialTags={tags}
                    availableTags={availableTags}
                  />
                </div>
              </div>

              <div className="pb-3 flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content
                </label>
                <textarea
                  id="noteContent"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows={20}
                  className="block w-full h-full rounded-md shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  placeholder="Enter note content"
                ></textarea>
              </div>

              {error && <div className="text-red-500">{error}</div>}
            </div>

            <div className="p-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition duration-150 ease-in-out"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-4 py-2 text-md bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out ${
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
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;