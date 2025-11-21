import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
} from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import TagModal from './Tag/TagModal';
import { Tag } from '../entities/Tag';
import {
    deleteTag as apiDeleteTag,
    createTag,
    updateTag,
} from '../utils/tagsService';
import { useStore } from '../store/useStore';

const Tags: React.FC = () => {
    const { t } = useTranslation();
    const {
        tagsStore: { tags, setTags, isLoading, isError, hasLoaded, loadTags },
    } = useStore();

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [hoveredTagUid, setHoveredTagUid] = useState<string | null>(null);
    const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

    // Load tags when component mounts
    useEffect(() => {
        if (!hasLoaded && !isLoading && !isError) {
            loadTags();
        }
    }, [hasLoaded, isLoading, isError, loadTags]);

    const handleDeleteTag = async () => {
        if (!tagToDelete) return;
        try {
            await apiDeleteTag(tagToDelete.uid!);
            setTags(tags.filter((tag) => tag.uid !== tagToDelete.uid));
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
            if (tagData.uid) {
                await updateTag(tagData.uid, tagData);
                setTags(
                    tags.map((tag) => (tag.uid === tagData.uid ? tagData : tag))
                );
            } else {
                const newTag = await createTag(tagData);
                setTags([...tags, newTag]);
            }
            setIsTagModalOpen(false);
            setSelectedTag(null);
        } catch (error) {
            console.error('Error saving tag:', error);
            // Re-throw the error so TagModal knows the operation failed
            throw error;
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

    // Group tags alphabetically by first letter
    const groupedTags = filteredTags.reduce(
        (groups, tag) => {
            const firstLetter = tag.name.charAt(0).toUpperCase();
            if (!groups[firstLetter]) {
                groups[firstLetter] = [];
            }
            groups[firstLetter].push(tag);
            return groups;
        },
        {} as Record<string, typeof tags>
    );

    // Sort the groups by letter and sort tags within each group
    const sortedGroupKeys = Object.keys(groupedTags).sort();
    sortedGroupKeys.forEach((letter) => {
        groupedTags[letter].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
    });

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
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                {/* Tags Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light">
                        {t('tags.title', 'Tags')}
                    </h2>
                    <button
                        type="button"
                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                        className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                            isSearchExpanded
                                ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        aria-expanded={isSearchExpanded}
                        aria-label={
                            isSearchExpanded
                                ? t(
                                      'common.hideSearch',
                                      'Collapse search panel'
                                  )
                                : t('common.showSearch', 'Show search input')
                        }
                        title={
                            isSearchExpanded
                                ? t('common.hideSearch', 'Hide search')
                                : t('common.search', 'Search tags')
                        }
                    >
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                        <span className="sr-only">
                            {isSearchExpanded
                                ? t('common.hideSearch', 'Hide search')
                                : t('common.search', 'Search tags')}
                        </span>
                    </button>
                </div>

                {/* Search input section, collapsible */}
                <div
                    className={`transition-all duration-300 ease-in-out ${
                        isSearchExpanded
                            ? 'max-h-24 opacity-100 mb-4'
                            : 'max-h-0 opacity-0 mb-0'
                    } overflow-hidden`}
                >
                    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-4 py-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder={t(
                                'tags.searchPlaceholder',
                                'Search tags...'
                            )}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Tags List */}
                {filteredTags.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('tags.noTagsFound', 'No tags found.')}
                    </p>
                ) : (
                    <div className="space-y-8">
                        {sortedGroupKeys.map((letter) => (
                            <div key={letter}>
                                {/* Alphabetical Group Header */}
                                <div className="mb-4">
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                        {letter}
                                    </h3>
                                    <hr className="border-gray-300 dark:border-gray-600" />
                                </div>

                                {/* Tags in this group */}
                                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedTags[letter].map((tag) => (
                                        <li
                                            key={tag.uid || tag.id}
                                            className="bg-white dark:bg-gray-900 shadow rounded-lg p-4"
                                            onMouseEnter={() =>
                                                setHoveredTagUid(
                                                    tag.uid || null
                                                )
                                            }
                                            onMouseLeave={() =>
                                                setHoveredTagUid(null)
                                            }
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {/* Tag Name - truncated */}
                                                <Link
                                                    to={
                                                        tag.uid
                                                            ? `/tag/${tag.uid}-${tag.name
                                                                  .toLowerCase()
                                                                  .replace(
                                                                      /[^a-z0-9]+/g,
                                                                      '-'
                                                                  )
                                                                  .replace(
                                                                      /^-|-$/g,
                                                                      ''
                                                                  )}`
                                                            : `/tag/${encodeURIComponent(tag.name)}`
                                                    }
                                                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate min-w-0 flex-1"
                                                    title={tag.name}
                                                >
                                                    {tag.name}
                                                </Link>

                                                {/* Action buttons */}
                                                <div className="flex space-x-2 flex-shrink-0">
                                                    <button
                                                        onClick={() =>
                                                            handleEditTag(tag)
                                                        }
                                                        className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity duration-200 ${
                                                            hoveredTagUid ===
                                                            tag.uid
                                                                ? 'opacity-100'
                                                                : 'opacity-0 pointer-events-none'
                                                        }`}
                                                        aria-label={`Edit ${tag.name}`}
                                                        title={`Edit ${tag.name}`}
                                                        data-testid={`tag-edit-${tag.uid || tag.id}`}
                                                    >
                                                        <PencilSquareIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            openConfirmDialog(
                                                                tag
                                                            )
                                                        }
                                                        className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity duration-200 ${
                                                            hoveredTagUid ===
                                                            tag.uid
                                                                ? 'opacity-100'
                                                                : 'opacity-0 pointer-events-none'
                                                        }`}
                                                        aria-label={`Delete ${tag.name}`}
                                                        title={`Delete ${tag.name}`}
                                                        data-testid={`tag-delete-${tag.uid || tag.id}`}
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                {/* TagModal */}
                {isTagModalOpen && (
                    <TagModal
                        isOpen={isTagModalOpen}
                        onClose={() => {
                            setIsTagModalOpen(false);
                            setSelectedTag(null);
                        }}
                        onSave={handleSaveTag}
                        onDelete={async (tagUid) => {
                            try {
                                await apiDeleteTag(tagUid);
                                setTags(
                                    tags.filter((tag) => tag.uid !== tagUid)
                                );
                                setIsTagModalOpen(false);
                                setSelectedTag(null);
                            } catch (error) {
                                console.error('Error deleting tag:', error);
                            }
                        }}
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
