import React, { useState, useEffect, useRef, useCallback } from 'react';
import TagInput from '../Tag/TagInput';
import { Note } from '../../entities/Note'; 
import { useDataContext } from '../../contexts/DataContext'; 

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  onSave?: (note: Note) => void;
}

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, note }) => {
  const { createNote, updateNote } = useDataContext(); 
  const [formData, setFormData] = useState<Note>(
    note || {
      title: '',
      content: '',
      tags: [],
    }
  );
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchAvailableTags = async () => {
        try {
          const response = await fetch('/api/tags', {
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
          });
          if (response.ok) {
            const data = await response.json();
            setAvailableTags(data.map((tag: { name: string }) => tag.name));
          } else {
            console.error('Failed to fetch available tags');
          }
        } catch (err) {
          console.error('Error fetching available tags:', err);
        }
      };
      fetchAvailableTags();
    }
  }, [isOpen]);

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
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((tagName) => ({ id: -1, name: tagName })),
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and Content are required.');
      return;
    }

    try {
      if (note?.id) {
        await updateNote(note.id, formData);
      } else {
        await createNote(formData); 
      }
      onClose(); 
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save note.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl mx-auto overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          <fieldset>
            <div className="p-4 space-y-4">
              {/* Note Title */}
              <div>
                <label
                  htmlFor="noteTitle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Note Title
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
              <div>
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
                  required
                  rows={5}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter note content"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tags
                </label>
                <TagInput
                  initialTags={formData?.tags?.map((tag) => tag.name) || []}
                  onTagsChange={handleTagsChange}
                  availableTags={availableTags}
                />
              </div>

              {/* Error Message */}
              {error && <div className="text-red-500 mb-4">{error}</div>}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {note?.id ? 'Update Note' : 'Create Note'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
