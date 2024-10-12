import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './components/Shared/ConfirmDialog'; // Adjust the path as necessary

interface Tag {
  id: number;
  name: string | null;
  active: boolean;
}

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState<string>('');
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        const data = await response.json();
        if (response.ok) {
          setTags(data.filter((tag: Tag) => tag.name !== null)); // Filter out tags without names
        } else {
          setError(data.error || 'Failed to fetch tags.');
        }
      } catch (err) {
        setError('Error fetching tags.');
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, []);

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }

    try {
      const response = await fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName }),
      });

      if (response.ok) {
        const newTag = await response.json();
        setTags((prevTags) => [...prevTags, newTag]);
        setNewTagName('');
        setIsCreatingTag(false);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create tag.');
      }
    } catch (err) {
      setError('Error creating tag.');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name || '');
  };

  const handleUpdateTag = async (tagId: number) => {
    if (!editingTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`/api/tag/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTagName }),
      });

      if (response.ok) {
        const updatedTag = await response.json();
        setTags((prevTags) => prevTags.map((tag) => (tag.id === tagId ? updatedTag : tag)));
        setEditingTagId(null);
        setEditingTagName('');
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update tag.');
      }
    } catch (err) {
      setError('Error updating tag.');
    }
  };

  const handleDelete = (tagId: number) => {
    setDeleteTagId(tagId);
  };

  const confirmDelete = async () => {
    if (!deleteTagId) return;

    try {
      const response = await fetch(`/api/tag/${deleteTagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTags((prevTags) => prevTags.filter((tag) => tag.id !== deleteTagId));
        setDeleteTagId(null);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete tag.');
      }
    } catch (err) {
      setError('Error deleting tag.');
    }
  };

  const cancelDelete = () => {
    setDeleteTagId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">Loading tags...</div>
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
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        {/* Tags Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <i className="bi bi-tags-fill text-xl mr-2"></i>
            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">Tags</h2>
          </div>
          <button
            onClick={() => setIsCreatingTag(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Add New Tag
          </button>
        </div>

        {/* Add Tag Form */}
        {isCreatingTag && (
          <div className="mb-4">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Enter tag name"
              autoFocus
              className="w-full px-3 py-2 mb-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => setIsCreatingTag(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tags List */}
        {tags.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No tags available.</p>
        ) : (
          <ul className="space-y-2">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center"
              >
                <div className="flex-grow overflow-hidden">
                  {/* Make tag name clickable */}
                  <Link
                    to={`/tag/${tag.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                  >
                    #{tag.name}
                  </Link>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${tag.name}`}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Edit Tag Form */}
        {editingTagId !== null && (
          <div className="mt-4 p-4 border rounded bg-gray-50 dark:bg-gray-800">
            <input
              type="text"
              value={editingTagName}
              onChange={(e) => setEditingTagName(e.target.value)}
              placeholder="Enter new tag name"
              autoFocus
              className="w-full px-3 py-2 mb-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => handleUpdateTag(editingTagId)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Update
              </button>
              <button
                onClick={() => {
                  setEditingTagId(null);
                  setEditingTagName('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTagId !== null && (
          <ConfirmDialog
            title="Delete Tag"
            message="Are you sure you want to delete this tag? This action cannot be undone."
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}
      </div>
    </div>
  );
};

export default Tags;
