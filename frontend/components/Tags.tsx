import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    TrashIcon,
    TagIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    BookOpenIcon,
    FolderIcon,
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
    const {
        tagsStore: { tags, setTags, isLoading, isError, loadTags },
    } = useStore();

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [hoveredTagId, setHoveredTagId] = useState<number | null>(null);
    const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [tagMetrics, setTagMetrics] = useState<
        Record<string, { tasks: number; notes: number; projects: number }>
    >({});
    const [metricsLoaded, setMetricsLoaded] = useState<boolean>(false);
    const [, setCachedProjects] = useState<any[]>([]);

    // Load tags when component mounts
    useEffect(() => {
        if (tags.length === 0 && !isLoading && !isError) {
            loadTags();
        }
    }, [tags.length, isLoading, isError, loadTags]);

    useEffect(() => {
        const loadMetrics = async () => {
            if (tags.length === 0) {
                // Tags not loaded yet, wait for them to be loaded
                return;
            }

            try {
                // Load all data at once for better performance
                const [projectsResponse, tasksResponse, notesResponse] =
                    await Promise.all([
                        fetch('/api/projects'),
                        fetch('/api/tasks'),
                        fetch('/api/notes'),
                    ]);

                let allProjects: any[] = [];
                let allTasks: any[] = [];
                let allNotes: any[] = [];

                if (projectsResponse.ok) {
                    const projectsData = await projectsResponse.json();
                    allProjects = projectsData.projects || projectsData || [];
                    setCachedProjects(allProjects);
                }

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    allTasks = tasksData.tasks || tasksData || [];
                }

                if (notesResponse.ok) {
                    const notesData = await notesResponse.json();
                    allNotes = notesData || [];
                }

                // Calculate metrics for all tags at once
                const metricsMap: Record<
                    string,
                    { tasks: number; notes: number; projects: number }
                > = {};

                tags.forEach((tag) => {
                    const tasksCount = allTasks.filter(
                        (task: any) =>
                            task.tags &&
                            task.tags.some(
                                (taskTag: any) => taskTag.name === tag.name
                            )
                    ).length;

                    const notesCount = allNotes.filter(
                        (note: any) =>
                            note.tags &&
                            note.tags.some(
                                (noteTag: any) => noteTag.name === tag.name
                            )
                    ).length;

                    const projectsCount = allProjects.filter(
                        (project: any) =>
                            project.tags &&
                            project.tags.some(
                                (projectTag: any) =>
                                    projectTag.name === tag.name
                            )
                    ).length;

                    metricsMap[tag.name] = {
                        tasks: tasksCount,
                        notes: notesCount,
                        projects: projectsCount,
                    };
                });

                setTagMetrics(metricsMap);
                setMetricsLoaded(true);
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        };

        loadMetrics();
    }, [tags]); // Only run when tags change

    const handleDeleteTag = async () => {
        if (!tagToDelete) return;
        try {
            await apiDeleteTag(tagToDelete.id!);
            setTags(tags.filter((tag) => tag.id !== tagToDelete.id));
            // Remove the deleted tag from metrics as well
            setTagMetrics((prev) => {
                const newMetrics = { ...prev };
                delete newMetrics[tagToDelete.name];
                return newMetrics;
            });
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
            if (tagData.id) {
                await updateTag(tagData.id, tagData);
                setTags(
                    tags.map((tag) => (tag.id === tagData.id ? tagData : tag))
                );
            } else {
                const newTag = await createTag(tagData);
                setTags([...tags, newTag]);
            }
            setIsTagModalOpen(false);
            setSelectedTag(null);
        } catch (error) {
            console.error('Error saving tag:', error);
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
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Tags Header */}
                <div className="flex items-center mb-8">
                    <TagIcon className="h-6 w-6 mr-2" />
                    <h2 className="text-2xl font-light">Tags</h2>
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
                    <p className="text-gray-700 dark:text-gray-300">
                        No tags found.
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
                                    {groupedTags[letter].map((tag) => {
                                        const metrics = tagMetrics[
                                            tag.name
                                        ] || {
                                            tasks: 0,
                                            notes: 0,
                                            projects: 0,
                                        };
                                        const hasItems =
                                            metrics.tasks > 0 ||
                                            metrics.notes > 0 ||
                                            metrics.projects > 0;

                                        return (
                                            <li
                                                key={tag.id}
                                                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4"
                                                onMouseEnter={() =>
                                                    setHoveredTagId(
                                                        tag.id || null
                                                    )
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredTagId(null)
                                                }
                                            >
                                                <div className="flex items-center justify-between">
                                                    {/* Tag Name and Metrics - inline */}
                                                    <div className="flex items-center space-x-3 flex-grow">
                                                        <Link
                                                            to={`/tag/${encodeURIComponent(tag.name)}`}
                                                            className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                                                        >
                                                            {tag.name}
                                                        </Link>

                                                        {/* Metrics - inline with tag name */}
                                                        {!metricsLoaded && (
                                                            <div className="flex items-center text-sm text-gray-400 dark:text-gray-500">
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
                                                            </div>
                                                        )}
                                                        {metricsLoaded &&
                                                            hasItems && (
                                                                <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                                                                    {metrics.projects >
                                                                        0 && (
                                                                        <div className="flex items-center space-x-1">
                                                                            <FolderIcon className="h-4 w-4 text-purple-500" />
                                                                            <span>
                                                                                {
                                                                                    metrics.projects
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {metrics.tasks >
                                                                        0 && (
                                                                        <div className="flex items-center space-x-1">
                                                                            <CheckIcon className="h-4 w-4 text-blue-500" />
                                                                            <span>
                                                                                {
                                                                                    metrics.tasks
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {metrics.notes >
                                                                        0 && (
                                                                        <div className="flex items-center space-x-1">
                                                                            <BookOpenIcon className="h-4 w-4 text-green-500" />
                                                                            <span>
                                                                                {
                                                                                    metrics.notes
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>

                                                    {/* Action buttons */}
                                                    <div className="flex space-x-2 ml-2">
                                                        <button
                                                            onClick={() =>
                                                                handleEditTag(
                                                                    tag
                                                                )
                                                            }
                                                            className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${hoveredTagId === tag.id ? 'opacity-100' : 'opacity-0'}`}
                                                            aria-label={`Edit ${tag.name}`}
                                                            title={`Edit ${tag.name}`}
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmDialog(
                                                                    tag
                                                                )
                                                            }
                                                            className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredTagId === tag.id ? 'opacity-100' : 'opacity-0'}`}
                                                            aria-label={`Delete ${tag.name}`}
                                                            title={`Delete ${tag.name}`}
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
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
                        onDelete={async (tagId) => {
                            try {
                                await apiDeleteTag(tagId);
                                setTags(tags.filter((tag) => tag.id !== tagId));
                                setTagMetrics((prev) => {
                                    const newMetrics = { ...prev };
                                    const deletedTag = tags.find(
                                        (t) => t.id === tagId
                                    );
                                    if (deletedTag) {
                                        delete newMetrics[deletedTag.name];
                                    }
                                    return newMetrics;
                                });
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
