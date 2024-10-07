// src/components/Note/EditNote.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TagInput from '../../TagInput'; // Correct Import Path

interface Tag {
  id: number | null;
  name: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  tags: Tag[];
}

const EditNote: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Extract note ID from URL
  const navigate = useNavigate();

  const [note, setNote] = useState<Note | null>(null); // State to hold the note data
  const [title, setTitle] = useState<string>(''); // State for the title input
  const [content, setContent] = useState<string>(''); // State for the content input
  const [tags, setTags] = useState<string[]>([]); // State for the tags as string[]
  const [availableTags, setAvailableTags] = useState<string[]>([]); // State for the available tags
  const [error, setError] = useState<string | null>(null); // Error state
  const [loading, setLoading] = useState<boolean>(true); // Loading state

  // Fetch note details and available tags when the component mounts
  useEffect(() => {
    const fetchNote = async () => {
      try {
        // Fetch note details
        const response = await fetch(`/api/note/${id}`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch note.');
        }
        const data: Note = await response.json();
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
        setTags(data.tags.map(tag => tag.name) || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch available tags
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

    fetchNote();
    fetchAvailableTags();
  }, [id]);

  // Memoize handleTagsChange to maintain a stable reference
  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!title.trim() || !content.trim()) {
      setError('Title and Content are required.');
      return;
    }

    try {
      const response = await fetch(`/api/note/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags: JSON.stringify(tags.map(tag => ({ value: tag }))), // Match backend expectations
        }),
      });
      if (response.ok) {
        navigate('/notes'); // Redirect to the notes list
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update note.');
      }
    } catch (err) {
      setError('Error updating note.');
      console.error('Error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading note...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-md rounded-md">
      <h2 className="text-2xl font-semibold mb-4">Edit Note</h2>
      <form onSubmit={handleSubmit}>
        {/* Title Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            placeholder="Note title"
            required
          />
        </div>

        {/* Content Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            rows={5}
            placeholder="Note content"
            required
          />
        </div>

        {/* Tags Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tags
          </label>
          <TagInput
            initialTags={tags}
            onTagsChange={handleTagsChange}
            availableTags={availableTags}
          />
        </div>

        {/* Error Message */}
        {error && <div className="text-red-500 mb-4">{error}</div>}

        {/* Form Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/notes')}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditNote;
