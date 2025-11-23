import React from 'react';
import { Link } from 'react-router-dom';
import { TagIcon, FolderIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Tag } from '../../entities/Tag';
import { Project } from '../../entities/Project';

interface InboxSelectedChipsProps {
    selectedTags: string[];
    selectedProjects: string[];
    tags: Tag[];
    projects: Project[];
    onRemoveTag: (tagName: string) => void;
    onRemoveProject: (projectName: string) => void;
}

const InboxSelectedChips: React.FC<InboxSelectedChipsProps> = ({
    selectedTags,
    selectedProjects,
    tags,
    projects,
    onRemoveTag,
    onRemoveProject,
}) => {
    const renderTagChip = (tagName: string, index: number) => {
        const tag = tags.find(
            (t) => t.name.toLowerCase() === tagName.toLowerCase()
        );

        if (tag) {
            return (
                <span
                    key={`${tagName}-${index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                >
                    <Link
                        to={`/tag/${encodeURIComponent(tag.name)}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {tagName}
                    </Link>
                    <button
                        onClick={() => onRemoveTag(tagName)}
                        className="h-3 w-3 text-blue-400 hover:text-red-500 transition-colors"
                        title="Remove tag"
                    >
                        <XMarkIcon className="h-3 w-3" />
                    </button>
                </span>
            );
        }

        return (
            <span
                key={`${tagName}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded text-orange-500 dark:text-orange-400"
            >
                {tagName}
                <button
                    onClick={() => onRemoveTag(tagName)}
                    className="h-3 w-3 text-orange-400 hover:text-red-500 transition-colors"
                    title="Remove tag"
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            </span>
        );
    };

    const renderProjectChip = (projectName: string, index: number) => {
        const project = projects.find(
            (p) => p.name.toLowerCase() === projectName.toLowerCase()
        );

        if (project) {
            return (
                <span
                    key={`${projectName}-${index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded text-green-600 dark:text-green-400"
                >
                    <Link
                        to={`/projects?project=${encodeURIComponent(project.name)}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {projectName}
                    </Link>
                    <button
                        onClick={() => onRemoveProject(projectName)}
                        className="h-3 w-3 text-green-400 hover:text-red-500 transition-colors"
                        title="Remove project"
                    >
                        <XMarkIcon className="h-3 w-3" />
                    </button>
                </span>
            );
        }

        return (
            <span
                key={`${projectName}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded text-orange-500 dark:text-orange-400"
            >
                {projectName}
                <button
                    onClick={() => onRemoveProject(projectName)}
                    className="h-3 w-3 text-orange-400 hover:text-red-500 transition-colors"
                    title="Remove project"
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            </span>
        );
    };

    return (
        <>
            {selectedTags.length > 0 && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                    <TagIcon className="h-3 w-3 mr-1" />
                    <div className="flex flex-wrap gap-1">
                        {selectedTags.map((tagName, index) =>
                            renderTagChip(tagName, index)
                        )}
                    </div>
                </div>
            )}

            {selectedProjects.length > 0 && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                    <FolderIcon className="h-3 w-3 mr-1" />
                    <div className="flex flex-wrap gap-1">
                        {selectedProjects.map((projectName, index) =>
                            renderProjectChip(projectName, index)
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default InboxSelectedChips;
