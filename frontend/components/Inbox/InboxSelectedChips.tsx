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
    const slugify = (text: string) =>
        text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

    const renderTagChip = (tagName: string, index: number) => {
        const tag = tags.find(
            (t) => t.name.toLowerCase() === tagName.toLowerCase()
        );

        if (tag) {
            const tagPath = tag.uid
                ? `/tag/${tag.uid}-${slugify(tag.name)}`
                : null;
            return (
                <span
                    key={`${tagName}-${index}`}
                    data-testid={`selected-tag-${tagName}`}
                    data-tag-exists="true"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                >
                    {tagPath ? (
                        <Link
                            to={tagPath}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {tagName}
                        </Link>
                    ) : (
                        <span>{tagName}</span>
                    )}
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
                data-testid={`selected-tag-${tagName}`}
                data-tag-exists="false"
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
                    data-testid={`selected-project-${projectName}`}
                    data-project-exists="true"
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
                data-testid={`selected-project-${projectName}`}
                data-project-exists="false"
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
                <div
                    data-testid="selected-tags-container"
                    className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1"
                >
                    <TagIcon className="h-3 w-3 mr-1" />
                    <div className="flex flex-wrap gap-1">
                        {selectedTags.map((tagName, index) =>
                            renderTagChip(tagName, index)
                        )}
                    </div>
                </div>
            )}

            {selectedProjects.length > 0 && (
                <div
                    data-testid="selected-projects-container"
                    className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1"
                >
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
