import React from 'react';
import { Link } from 'react-router-dom';
import {
    TagIcon,
    FolderIcon,
    XMarkIcon,
    CalendarDaysIcon,
    CalendarIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import {
    TagIcon as SolidTagIcon,
    FolderIcon as SolidFolderIcon,
} from '@heroicons/react/24/solid';
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
    // "line" shows everything on one row, the way a task row shows its
    // project, tags and due date.
    variant?: 'chips' | 'line';
}

const tagColorStyle = (color?: string): React.CSSProperties | undefined => {
    if (!color) return undefined;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`, color };
};

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
    variant = 'chips',
}) => {
    const { t } = useTranslation();
    const slugify = (text: string) =>
        text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

    const formatDateLabel = (chip: InboxDateChip) => {
        const parsed = parseDateString(chip.date);
        const formatted = parsed
            ? formatLocalizedDate(parsed, 'EEE, MMM d')
            : chip.date;
        return chip.recurring
            ? t('inbox.recurringFrom', '{{phrase}}, from {{date}}', {
                  phrase: chip.phrase,
                  date: formatted,
              })
            : formatted;
    };

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
        const label = formatDateLabel(chip);

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

    const removeButton = (onClick: () => void, title: string) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="ml-0.5 text-gray-400 hover:text-red-500 dark:text-gray-500 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded-sm"
        >
            <XMarkIcon className="h-3 w-3" />
        </button>
    );

    if (variant === 'line') {
        const hasAny =
            selectedProjects.length > 0 ||
            selectedTags.length > 0 ||
            !!dueDate ||
            !!assignee;
        if (!hasAny) return null;

        // Names that do not exist yet will be created on save, so they keep
        // the amber color the chips use for the same thing.
        const newItemClass = 'text-amber-600 dark:text-amber-400';

        return (
            <div
                data-testid="capture-metadata"
                className="flex items-center gap-3 whitespace-nowrap overflow-x-auto text-xs text-gray-500 dark:text-gray-400 pb-1.5"
            >
                {selectedProjects.length > 0 && (
                    <div
                        data-testid="selected-projects-container"
                        className="flex items-center gap-2"
                    >
                        <SolidFolderIcon className="h-3 w-3 flex-shrink-0" />
                        {selectedProjects.map((projectName, index) => {
                            const exists = projects.some(
                                (p) =>
                                    p.name.toLowerCase() ===
                                    projectName.toLowerCase()
                            );
                            return (
                                <span
                                    key={`${projectName}-${index}`}
                                    data-testid={`selected-project-${projectName}`}
                                    data-project-exists={String(exists)}
                                    className={`inline-flex items-center max-w-[12rem] ${exists ? '' : newItemClass}`}
                                >
                                    <span className="truncate">
                                        {projectName}
                                    </span>
                                    {removeButton(
                                        () => onRemoveProject(projectName),
                                        t('inbox.removeProject')
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}
                {selectedTags.length > 0 && (
                    <div
                        data-testid="selected-tags-container"
                        className="flex items-center gap-1.5"
                    >
                        <SolidTagIcon className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                        {selectedTags.map((tagName, index) => {
                            const tag = tags.find(
                                (x) =>
                                    x.name.toLowerCase() ===
                                    tagName.toLowerCase()
                            );
                            return (
                                <span
                                    key={`${tagName}-${index}`}
                                    data-testid={`selected-tag-${tagName}`}
                                    data-tag-exists={String(!!tag)}
                                    className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-medium bg-white dark:bg-gray-900 ${tag ? 'text-gray-500 dark:text-gray-400' : newItemClass}`}
                                    style={
                                        tag
                                            ? tagColorStyle(tag.color)
                                            : undefined
                                    }
                                >
                                    {tagName}
                                    {removeButton(
                                        () => onRemoveTag(tagName),
                                        t('inbox.removeTag')
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}
                {dueDate && (
                    <div
                        data-testid="selected-due-date"
                        className="flex items-center"
                    >
                        <CalendarIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span>{formatDateLabel(dueDate)}</span>
                        {onDismissDate &&
                            removeButton(
                                onDismissDate,
                                t('inbox.keepDateAsText', 'Keep as text')
                            )}
                    </div>
                )}
                {assignee && (
                    <div
                        data-testid="selected-assignee"
                        className="flex items-center"
                    >
                        <UserIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                        {assignee.color && (
                            <span
                                className="h-2 w-2 mr-1 rounded-full"
                                style={{ backgroundColor: assignee.color }}
                                aria-hidden="true"
                            />
                        )}
                        <span>{assignee.name}</span>
                        {onRemovePerson &&
                            removeButton(
                                onRemovePerson,
                                t('inbox.removeAssignee', 'Remove assignee')
                            )}
                    </div>
                )}
            </div>
        );
    }

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
