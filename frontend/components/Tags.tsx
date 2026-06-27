import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    EllipsisVerticalIcon,
    MagnifyingGlassIcon,
    LockClosedIcon,
    MapPinIcon,
    FolderIcon,
    DocumentTextIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
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
    const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasLoaded && !isLoading && !isError) {
            loadTags();
        }
    }, [hasLoaded, isLoading, isError, loadTags]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }
            const clickedElement = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(clickedElement)
            ) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

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
                    tags.map((tag) =>
                        tag.uid === tagData.uid ? { ...tag, ...tagData } : tag
                    )
                );
            } else {
                const newTag = await createTag(tagData);
                setTags([...tags, newTag]);
            }
            setIsTagModalOpen(false);
            setSelectedTag(null);
        } catch (error) {
            console.error('Error saving tag:', error);
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
                    {t('tags.loadingTags', 'Loading tags...')}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-red-500 p-4">
                {t('tags.errorLoadingTags', 'Error loading tags.')}
            </div>
        );
    }

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                {/* Header */}
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
                                ? t('common.hideSearch', 'Collapse search panel')
                                : t('common.showSearch', 'Show search input')
                        }
                    >
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                    </button>
                </div>

                {/* Collapsible search */}
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

                {/* Tags grid, grouped alphabetically */}
                {filteredTags.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('tags.noTagsFound', 'No tags found.')}
                    </p>
                ) : (
                    <div className="space-y-8">
                        {sortedGroupKeys.map((letter) => (
                            <div key={letter}>
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                                    {letter}
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {groupedTags[letter].map((tag) => {
                                        const isSystem = tag.tag_type === 'system';
                                        return (
                                            <Link
                                                key={tag.uid || tag.id}
                                                to={
                                                    tag.uid
                                                        ? `/tag/${tag.uid}-${tag.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
                                                        : `/tag/${encodeURIComponent(tag.name)}`
                                                }
                                                className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer ${
                                                    !tag.color
                                                        ? isSystem
                                                            ? 'bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500'
                                                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                                        : ''
                                                } ${dropdownOpen === tag.uid ? 'z-50' : ''}`}
                                                style={
                                                    tag.color
                                                        ? {
                                                            backgroundColor: tag.color,
                                                            ...(isSystem ? { outline: '2px dashed rgba(255,255,255,0.45)', outlineOffset: '-3px' } : {}),
                                                          }
                                                        : {}
                                                }
                                            >
                                                {/* Top-left: lock badge for system tags */}
                                                {isSystem && (
                                                    <span className="absolute top-2 left-2 z-10 flex items-center justify-center pointer-events-none">
                                                        <LockClosedIcon
                                                            className={`h-3.5 w-3.5 ${tag.color ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}
                                                            title={t('tags.systemTag', 'System tag')}
                                                        />
                                                    </span>
                                                )}

                                                {/* Top-right: three-dot menu */}
                                                <div
                                                    className="absolute top-2 right-2 z-10"
                                                    ref={dropdownRef}
                                                >
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const next = dropdownOpen === tag.uid ? null : tag.uid!;
                                                            if (next !== null) justOpenedRef.current = true;
                                                            setDropdownOpen(next);
                                                        }}
                                                        className={`flex items-center justify-center w-6 h-6 rounded focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                                                            tag.color
                                                                ? 'text-white/60 hover:text-white hover:bg-white/20'
                                                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                        }`}
                                                        aria-label={t('tags.toggleDropdownMenu', 'Toggle dropdown menu')}
                                                        data-testid={`tag-dropdown-${tag.uid || tag.id}`}
                                                    >
                                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                                    </button>

                                                    {dropdownOpen === tag.uid && (
                                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditTag(tag);
                                                                    setDropdownOpen(null);
                                                                }}
                                                                className={`block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left ${
                                                                    isSystem ? 'rounded-md' : 'rounded-t-md'
                                                                }`}
                                                                data-testid={`tag-edit-${tag.uid || tag.id}`}
                                                            >
                                                                {isSystem
                                                                    ? t('tags.customize', 'Customize')
                                                                    : t('tags.edit', 'Edit')}
                                                            </button>
                                                            {!isSystem && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        openConfirmDialog(tag);
                                                                        setDropdownOpen(null);
                                                                    }}
                                                                    className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                                                    data-testid={`tag-delete-${tag.uid || tag.id}`}
                                                                >
                                                                    {t('tags.delete', 'Delete')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tag name */}
                                                <div className="px-4 pt-3 pb-2 flex-1 flex items-center justify-center text-center">
                                                    <div>
                                                        {tag.pinned && !isSystem && (
                                                            <div className="flex items-center justify-center mb-0.5">
                                                                <MapPinIcon
                                                                    className={`h-3 w-3 flex-shrink-0 ${tag.color ? 'text-white/60' : 'text-blue-400 dark:text-blue-500'}`}
                                                                    title={t('tags.pinned', 'Pinned')}
                                                                />
                                                            </div>
                                                        )}
                                                        <h4 className={`text-sm font-semibold tracking-widest line-clamp-2 ${tag.color ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                                                            {tag.name}
                                                        </h4>
                                                    </div>
                                                </div>

                                                {/* Stats footer */}
                                                <div className={`rounded-b-xl flex items-stretch divide-x ${
                                                    tag.color
                                                        ? 'bg-black/20 divide-white/10'
                                                        : 'bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600'
                                                }`}>
                                                    {[
                                                        { icon: <CheckCircleIcon className="h-3.5 w-3.5" />, count: tag.tasks_count ?? 0, label: t('tags.stats.tasks', 'tasks') },
                                                        { icon: <DocumentTextIcon className="h-3.5 w-3.5" />, count: tag.notes_count ?? 0, label: t('tags.stats.notes', 'notes') },
                                                        { icon: <FolderIcon className="h-3.5 w-3.5" />, count: tag.projects_count ?? 0, label: t('tags.stats.projects', 'projects') },
                                                    ].map(({ icon, count, label }) => (
                                                        <div key={label} className="flex-1 flex flex-col items-center py-2 gap-0.5">
                                                            <span className={`text-sm font-semibold leading-none ${tag.color ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                                                {count}
                                                            </span>
                                                            <span className={`flex items-center gap-1 text-[10px] leading-none ${tag.color ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                {icon}
                                                                {label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
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
