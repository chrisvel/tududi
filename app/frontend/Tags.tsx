// src/Tags.tsx

import React, { useState, useEffect } from 'react';
import { TagIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
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
        console.log('Fetched Tags:', data); // Debugging line
        if (response.ok) {
          if (Array.isArray(data)) {
            const filteredTags = data.filter(tag => tag.name !== null);
            setTags(filteredTags);
          } else {
            console.error('Unexpected data format:', data);
            setTags([]);
          }
        } else {
          setError(data.error || 'Failed to fetch tags.');
          setTags([]);
        }
      } catch (err) {
        console.error('Error fetching tags:', err);
        setError('Error fetching tags.');
        setTags([]);
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
        setTags(prevTags => [...prevTags, newTag]);
        setNewTagName('');
        setIsCreatingTag(false);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create tag.');
      }
    } catch (err) {
      console.error('Error creating tag:', err);
      setError('Error creating tag.');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name || '');
    setError(null);
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
        const data = await response.json();
        setTags(prevTags =>
          prevTags.map(tag => (tag.id === tagId ? data.tag : tag))
        );
        setEditingTagId(null);
        setEditingTagName('');
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update tag.');
      }
    } catch (err) {
      console.error('Error updating tag:', err);
      setError('Error updating tag.');
    }
  };

  const handleDelete = (tagId: number) => {
    setDeleteTagId(tagId);
    setError(null);
  };

  const confirmDelete = async () => {
    if (deleteTagId === null) return;

    try {
      const response = await fetch(`/api/tag/${deleteTagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTags(prevTags => prevTags.filter(tag => tag.id !== deleteTagId));
        setDeleteTagId(null);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete tag.');
      }
    } catch (err) {
      console.error('Error deleting tag:', err);
      setError('Error deleting tag.');
    }
  };

  const cancelDelete = () => {
    setDeleteTagId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  if (loading) {
    return <div className="text-gray-700 dark:text-gray-300">Loading tags...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Tags</h2>
      
      {/* Add Tag Button */}
      {!isCreatingTag && (
        <button
          onClick={() => setIsCreatingTag(true)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
        >
          Add New Tag
        </button>
      )}

      {/* Add Tag Form */}
      {isCreatingTag && (
        <div className="mb-4">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter tag name"
            autoFocus
            className="w-full px-3 py-2 mb-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleAddTag}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsCreatingTag(false);
                setNewTagName('');
                setError(null);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
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
            <li key={tag.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">
                  #{tag.name}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{tag.name}</span>
              </div>
              <div className="flex space-x-2">
                {/* Edit Button */}
                <button
                  onClick={() => handleEdit(tag)}
                  className="text-yellow-500 hover:text-yellow-600 focus:outline-none"
                  aria-label="Edit Tag"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="text-red-500 hover:text-red-600 focus:outline-none"
                  aria-label="Delete Tag"
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
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Edit Tag</h3>
          <input
            type="text"
            value={editingTagName}
            onChange={(e) => setEditingTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdateTag(editingTagId);
              if (e.key === 'Escape') {
                setEditingTagId(null);
                setEditingTagName('');
                setError(null);
              }
            }}
            placeholder="Enter new tag name"
            autoFocus
            className="w-full px-3 py-2 mb-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => handleUpdateTag(editingTagId)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
            >
              Update
            </button>
            <button
              onClick={() => {
                setEditingTagId(null);
                setEditingTagName('');
                setError(null);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
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
  );
};

export default Tags;
