import React from 'react';
import { TFunction } from 'i18next';
import {
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TagIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { Tag } from '../../entities/Tag';
import PushPinIcon from '../Shared/Icons/PushPinIcon';

interface TagHeroProps {
    tag: Tag;
    t: TFunction;
    tasksCount: number;
    notesCount: number;
    projectsCount: number;
    doneCount: number;
    totalCount: number;
    editButtonRef: React.RefObject<HTMLButtonElement>;
    onSearchToggle: () => void;
    onTogglePin: () => void;
    onDeleteClick: () => void;
}

// Same card as the goal, area and project headers: tinted surface, icon
// tile, title, outlined actions, and a progress bar for the tasks.
const TagHero: React.FC<TagHeroProps> = ({
    tag,
    t,
    tasksCount,
    notesCount,
    projectsCount,
    doneCount,
    totalCount,
    editButtonRef,
    onSearchToggle,
    onTogglePin,
    onDeleteClick,
}) => {
    const isSystem = tag.tag_type === 'system';
    const tint = tag.color || '#3b82f6';
    const percent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const actionClass =
        'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

    return (
        <div className="mb-6 space-y-3">
            <div
                className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 dark:bg-gray-900"
                style={{
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${tint} 10%, transparent), color-mix(in srgb, ${tint} 10%, transparent))`,
                }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <span
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-4 ring-white dark:bg-gray-800 dark:ring-gray-900"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 18%, transparent)`,
                            color: tint,
                        }}
                    >
                        <TagIcon className="h-7 w-7" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {isSystem
                                    ? t('tags.systemTag', 'System tag')
                                    : t('tags.tag', 'Tag')}
                            </span>
                            <span>
                                {tasksCount} {t('tags.stats.tasks', 'tasks')}
                            </span>
                            <span>·</span>
                            <span>
                                {notesCount} {t('tags.stats.notes', 'notes')}
                            </span>
                            {projectsCount > 0 && (
                                <>
                                    <span>·</span>
                                    <span>
                                        {projectsCount}{' '}
                                        {t('tags.stats.projects', 'projects')}
                                    </span>
                                </>
                            )}
                        </div>

                        <h1
                            className="line-clamp-2 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl dark:text-gray-100"
                            data-testid="tag-name"
                        >
                            {tag.name}
                        </h1>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onSearchToggle}
                            className={actionClass}
                            title={t('common.search', 'Search tasks')}
                        >
                            <MagnifyingGlassIcon className="h-4 w-4" />
                            {t('common.search', 'Search')}
                        </button>
                        <button
                            type="button"
                            onClick={onTogglePin}
                            className={actionClass}
                            aria-pressed={!!tag.pinned}
                            title={
                                tag.pinned
                                    ? t(
                                          'tags.unpinFromSidebar',
                                          'Unpin from sidebar'
                                      )
                                    : t('tags.pinToSidebar', 'Pin to sidebar')
                            }
                        >
                            <PushPinIcon
                                className={`h-4 w-4 ${tag.pinned ? 'text-red-500 dark:text-red-400' : ''}`}
                                filled={!!tag.pinned}
                            />
                            {tag.pinned
                                ? t('project.pinned', 'Pinned')
                                : t('project.pin', 'Pin')}
                        </button>
                        <button
                            type="button"
                            ref={editButtonRef}
                            className={actionClass}
                            aria-label={t('tags.editTagAriaLabel', {
                                tagName: tag.name,
                            })}
                            title={t('tags.editTagTitle', {
                                tagName: tag.name,
                            })}
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            {isSystem
                                ? t('tags.customize', 'Customize')
                                : t('common.edit', 'Edit')}
                        </button>
                        {!isSystem && (
                            <button
                                type="button"
                                onClick={onDeleteClick}
                                className={actionClass}
                                aria-label={t('tags.deleteTagAriaLabel', {
                                    tagName: tag.name,
                                })}
                                title={t('tags.deleteTagTitle', {
                                    tagName: tag.name,
                                })}
                            >
                                <TrashIcon className="h-4 w-4" />
                                {t('common.delete', 'Delete')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        <span>
                            {t(
                                'tags.progressSummary',
                                'Tag progress · {{done}} of {{total}} tasks done',
                                { done: doneCount, total: totalCount }
                            )}
                        </span>
                        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {percent}
                            <span className="ml-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                %
                            </span>
                        </span>
                    </div>
                    <div
                        className="relative h-1.5 rounded-full"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 20%, transparent)`,
                        }}
                    >
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagHero;
