import React from 'react';
import { Link } from 'react-router-dom';
import { TFunction } from 'i18next';
import {
    FolderIcon,
    PencilSquareIcon,
    ShareIcon,
} from '@heroicons/react/24/outline';
import { Area } from '../../entities/Area';

interface AreaHeroProps {
    area: Area;
    t: TFunction;
    projectsCount: number;
    goalsCount: number;
    tasksCount: number;
    doneCount: number;
    totalCount: number;
    onShareClick: () => void;
    onEditClick: () => void;
}

// Same card as the project and goal headers: tinted surface, icon tile,
// title, actions, and a progress bar for the tasks in the area.
const AreaHero: React.FC<AreaHeroProps> = ({
    area,
    t,
    projectsCount,
    goalsCount,
    tasksCount,
    doneCount,
    totalCount,
    onShareClick,
    onEditClick,
}) => {
    const tint = area.color || '#3b82f6';
    const percent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const actionClass =
        'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';
    const statClass = 'hover:underline text-gray-500 dark:text-gray-400';

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
                        <FolderIcon className="h-7 w-7" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="rounded-md px-2 py-0.5 font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {t('areas.singular', 'Area')}
                            </span>
                            <Link
                                to={`/projects?area=${area.uid}`}
                                className={statClass}
                            >
                                {projectsCount}{' '}
                                {t('areas.projects', 'projects')}
                            </Link>
                            <span>·</span>
                            <span>
                                {goalsCount} {t('areas.goals', 'goals')}
                            </span>
                            <span>·</span>
                            <span>
                                {tasksCount} {t('areas.tasks', 'tasks')}
                            </span>
                        </div>

                        <h1
                            className="line-clamp-2 text-xl font-semibold uppercase leading-tight tracking-wide text-gray-900 sm:text-2xl dark:text-gray-100"
                            data-testid="area-name"
                        >
                            {area.name}
                        </h1>
                        {area.description && (
                            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                {area.description}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onShareClick}
                            className={actionClass}
                        >
                            <ShareIcon className="h-4 w-4" />
                            {t('projectItem.share', 'Share')}
                        </button>
                        <button
                            type="button"
                            onClick={onEditClick}
                            className={actionClass}
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            {t('common.edit', 'Edit')}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        <span>
                            {t(
                                'areas.progressSummary',
                                'Area progress · {{done}} of {{total}} tasks done',
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

export default AreaHero;
