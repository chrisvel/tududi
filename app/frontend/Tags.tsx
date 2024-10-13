import React, { useEffect, useState } from 'react';
import { Tag } from './entities/Tag';
import { Link } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon, TagIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './components/Shared/ConfirmDialog';
import TagModal from './components/Tag/TagModal';

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok) {
          setTags(data || []);
        } else {
          throw new Error(data.error || 'Failed to fetch tags.');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      const response = await fetch(`/api/tag/${tagToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        setTags((prevTags) => prevTags.filter((tag) => tag.id !== tagToDelete.id));
        setIsConfirmDialogOpen(false);
        setTagToDelete(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tag.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setIsTagModalOpen(true);
  };

  const handleCreateTag = () => {
    setSelectedTag(null);
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async (tagData: Tag) => {
    if (tagData.id) {
      // Update existing tag
      try {
        const response = await fetch(`/api/tags/${tagData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(tagData),
        });

        if (response.ok) {
          const updatedTag = await response.json();
          setTags((prevTags) =>
            prevTags.map((t) => (t.id === updatedTag.id ? updatedTag : t))
          );
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update tag.');
        }
      } catch (error) {
        setError((error as Error).message);
      }
    } else {
      // Create new tag
      try {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(tagData),
        });

        if (response.ok) {
          const newTag = await response.json();
          setTags((prevTags) => [...prevTags, newTag]);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create tag.');
        }
      } catch (error) {
        setError((error as Error).message);
      }
    }

    setIsTagModalOpen(false);
    setSelectedTag(null);
  };

  const openConfirmDialog = (tag: Tag) => {
    setTagToDelete(tag);
    setIsConfirmDialogOpen(true);
  };

  const closeConfirmDialog = () => {
    setIsConfirmDialogOpen(false);
    setTagToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading tags...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Tags Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <TagIcon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">Tags</h2>
          </div>
        </div>

        {/* Tags List */}
        {tags.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No tags found.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center"
              >
                {/* Tag Content */}
                <div className="flex-grow overflow-hidden pr-4">
                  <Link
                    to={`/tag/${tag.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                  >
                    {tag.name}
                  </Link>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditTag(tag)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${tag.name}`}
                    title={`Edit ${tag.name}`}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => openConfirmDialog(tag)}
                    className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                    aria-label={`Delete ${tag.name}`}
                    title={`Delete ${tag.name}`}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* TagModal */}
        {isTagModalOpen && (
          <TagModal
            isOpen={isTagModalOpen}
            onClose={() => setIsTagModalOpen(false)}
            onSave={handleSaveTag}
            tag={selectedTag}
          />
        )}

        {/* ConfirmDialog */}
        {isConfirmDialogOpen && tagToDelete && (
          <ConfirmDialog
            title="Delete Tag"
            message={`Are you sure you want to delete the tag "${tagToDelete.name}"?`}
            onConfirm={handleDeleteTag}
            onCancel={closeConfirmDialog}
          />
        )}
      </div>
    </div>
  );
};

export default Tags;
