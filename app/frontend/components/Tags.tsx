import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import TagModal from './Tag/TagModal';
import { Tag } from '../entities/Tag';
import { fetchTags, createTag, updateTag, deleteTag as apiDeleteTag } from '../utils/apiService';

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const fetchedTags = await fetchTags();
        setTags(fetchedTags);
      } catch (error) {
        console.error('Failed to fetch tags:', error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, []);

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      await apiDeleteTag(tagToDelete.id!);
      setTags((prev) => prev.filter((tag) => tag.id !== tagToDelete.id));
      setIsConfirmDialogOpen(false);
      setTagToDelete(null);
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async (tagData: Tag) => {
    try {
      let updatedTags;
      if (tagData.id) {
        await updateTag(tagData.id, tagData);
        updatedTags = tags.map((tag) => (tag.id === tagData.id ? tagData : tag));
      } else {
        const newTag = await createTag(tagData);
        updatedTags = [...tags, newTag];
      }
      setTags(updatedTags);
      setIsTagModalOpen(false);
      setSelectedTag(null);
    } catch (err) {
      console.error('Failed to save tag:', err);
    }
  };

  const openConfirmDialog = (tag: Tag) => {
    setTagToDelete(tag);
    setIsConfirmDialogOpen(true);
  };

  const closeConfirmDialog = () => {
    setIsConfirmDialogOpen(false);
    setTagToDelete(null);
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading tags...
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500 p-4">Error loading tags.</div>;
  }

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Tags Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <TagIcon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">Tags</h2>
          </div>
        </div>

        {/* Search Bar with Icon */}
        <div className="mb-4">
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {/* Tags List */}
        {filteredTags.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No tags found.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTags.map((tag) => (
              <li
                key={tag.id}
                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center"
              >
                <div className="flex-grow overflow-hidden pr-4">
                  <Link
                    to={`/tag/${tag.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                  >
                    {tag.name}
                  </Link>
                </div>

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