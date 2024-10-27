import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import TagModal from './Tag/TagModal';
import { useDataContext } from '../contexts/DataContext';

const Tags: React.FC = () => {
  const { tags, createTag, updateTag, deleteTag, isLoading, isError } = useDataContext();
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      await deleteTag(tagToDelete.id);
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

  const handleCreateTag = () => {
    setSelectedTag(null);
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async (tagData: Tag) => {
    try {
      if (tagData.id) {
        await updateTag(tagData.id, tagData);
      } else {
        await createTag(tagData);
      }
    } catch (err) {
      console.error('Failed to save tag:', err);
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

  const filteredTags = tags.filter(
    (tag) =>
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
    return <div className="text-red-500 p-4">Error loading tags</div>;
  }

  return (
    <div className="flex justify-center px-4">
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
