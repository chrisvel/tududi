import React from 'react';
import { Link } from 'react-router-dom';
import {
    TagIcon,
    FolderIcon,
    XMarkIcon,
    CalendarDaysIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../entities/Tag';
import { Project } from '../../entities/Project';
import { formatLocalizedDate, parseDateString } from '../../utils/dateUtils';

export interface InboxDateChip {
    date: string;
    phrase: string | null;
    recurring: boolean;
}

export interface InboxPersonChip {
    name: string;
    color?: string | null;
}

interface InboxSelectedChipsProps {
    selectedTags: string[];
    selectedProjects: string[];
    tags: Tag[];
    projects: Project[];
    onRemoveTag: (tagName: string) => void;
    onRemoveProject: (projectName: string) => void;
    dueDate?: InboxDateChip | null;
    assignee?: InboxPersonChip | null;
    onDismissDate?: () => void;
    onRemovePerson?: () => void;
}

const InboxSelectedChips: React.FC<InboxSelectedChipsProps> = ({
    selectedTags,
    selectedProjects,
    tags,
    projects,
    onRemoveTag,
    onRemoveProject,
    dueDate = null,
    assignee = null,
    onDismissDate,
    onRemovePerson,
}) => {
    const { t } = useTranslation();
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
                        title={t('inbox.removeTag')}
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
                    title={t('inbox.removeTag')}
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
                        title={t('inbox.removeProject')}
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
                    title={t('inbox.removeProject')}
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            </span>
        );
    };

    const renderDateChip = (chip: InboxDateChip) => {
        const parsed = parseDateString(chip.date);
        const formatted = parsed
            ? formatLocalizedDate(parsed, 'EEE, MMM d')
            : chip.date;
        const label = chip.recurring
            ? t('inbox.recurringFrom', '{{phrase}}, from {{date}}', {
                  phrase: chip.phrase,
                  date: formatted,
              })
            : formatted;

        return (
            <span
                data-testid="selected-due-date"
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-amber-700 dark:text-amber-400"
            >
                {label}
                {onDismissDate && (
                    <button
                        type="button"
                        onClick={onDismissDate}
                        className="h-3 w-3 text-amber-500 hover:text-red-500 transition-colors"
                        title={t('inbox.keepDateAsText', 'Keep as text')}
                    >
                        <XMarkIcon className="h-3 w-3" />
                    </button>
                )}
            </span>
        );
    };

    const renderPersonChip = (chip: InboxPersonChip) => (
        <span
            data-testid="selected-assignee"
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded text-indigo-600 dark:text-indigo-300"
        >
            {chip.color && (
                <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: chip.color }}
                    aria-hidden="true"
                />
            )}
            {chip.name}
            {onRemovePerson && (
                <button
                    type="button"
                    onClick={onRemovePerson}
                    className="h-3 w-3 text-indigo-400 hover:text-red-500 transition-colors"
                    title={t('inbox.removeAssignee', 'Remove assignee')}
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            )}
        </span>
    );

    return (
        <>
            {dueDate && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                    <CalendarDaysIcon className="h-3 w-3 mr-1" />
                    {renderDateChip(dueDate)}
                </div>
            )}

            {assignee && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                    <UserIcon className="h-3 w-3 mr-1" />
                    {renderPersonChip(assignee)}
                </div>
            )}

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
