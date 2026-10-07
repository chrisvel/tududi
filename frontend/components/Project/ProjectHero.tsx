import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TFunction } from 'i18next';
import { differenceInCalendarDays, format } from 'date-fns';
import {
    CameraIcon,
    EllipsisHorizontalIcon,
    FolderIcon,
    PencilSquareIcon,
    ShareIcon,
    StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { getAssetPath } from '../../config/paths';
import { getProjectStatusTint } from './projectStatusStyles';

interface ProjectHeroProps {
    project: Project;
    areas: Area[];
    t: TFunction;
    doneCount: number;
    totalCount: number;
    onEditClick: () => void;
    onDeleteClick: () => void;
    onShareClick: () => void;
    onSaveAsTemplate?: () => void;
    onEditBannerClick?: () => void;
    onTogglePin?: () => void;
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const ProjectHero: React.FC<ProjectHeroProps> = ({
    project,
    areas,
    t,
    doneCount,
    totalCount,
    onEditClick,
    onDeleteClick,
    onShareClick,
    onSaveAsTemplate,
    onEditBannerClick,
    onTogglePin,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const area = project.area || (project as any).Area;
    const areaUid =
        area?.uid || areas.find((a) => a.id === area?.id)?.uid || null;
    const percent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const startDate = project.created_at ? new Date(project.created_at) : null;
    const dueDate = project.due_date_at ? new Date(project.due_date_at) : null;
    const today = new Date();
    const daysLeft = dueDate ? differenceInCalendarDays(dueDate, today) : null;
    // How much of the time between start and due date has passed, so the
    // progress bar can show whether tasks keep up with the calendar.
    const timeUsed =
        startDate && dueDate && dueDate > startDate
            ? Math.min(
                  100,
                  Math.max(
                      0,
                      Math.round(
                          ((today.getTime() - startDate.getTime()) /
                              (dueDate.getTime() - startDate.getTime())) *
                              100
                      )
                  )
              )
            : null;

    const dueText =
        daysLeft === null
            ? null
            : daysLeft > 0
              ? t('project.daysToDue', '{{count}} days to due date', {
                    count: daysLeft,
                })
              : daysLeft === 0
                ? t('projectItem.dueToday', 'Due today')
                : t('project.daysOverdue', '{{count}} days overdue', {
                      count: Math.abs(daysLeft),
                  });

    const tint = project.color || '#3b82f6';
    const menuItemClass =
        'block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';
    const actionClass =
        'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

    return (
        <div className="mb-6 space-y-3">
            <nav
                className="flex flex-wrap items-center gap-2 text-sm text-gray-400 dark:text-gray-500"
                aria-label={t('common.breadcrumb', 'Breadcrumb')}
            >
                {area?.name && areaUid && (
                    <>
                        <Link
                            to={`/area/${areaUid}-${slugify(area.name)}`}
                            className="hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            {area.name}
                        </Link>
                        <span>/</span>
                    </>
                )}
                <Link
                    to="/projects"
                    className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                    {t('sidebar.projects', 'Projects')}
                </Link>
                <span>/</span>
                <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                    {project.name}
                </span>
            </nav>

            <div
                className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 dark:bg-gray-900"
                style={{
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${tint} 10%, transparent), color-mix(in srgb, ${tint} 10%, transparent))`,
                }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <button
                        type="button"
                        onClick={onEditBannerClick}
                        disabled={!onEditBannerClick}
                        className="group relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-4 ring-white dark:bg-gray-800 dark:ring-gray-900"
                        title={t('project.projectImage', 'Project image')}
                        aria-label={t('project.projectImage', 'Project image')}
                    >
                        {project.image_url ? (
                            <img
                                src={getAssetPath(project.image_url)}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span
                                className="flex h-full w-full items-center justify-center"
                                style={{
                                    backgroundColor: `color-mix(in srgb, ${tint} 18%, transparent)`,
                                    color: tint,
                                }}
                            >
                                <FolderIcon className="h-7 w-7" />
                            </span>
                        )}
                        {onEditBannerClick && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <CameraIcon className="h-5 w-5" />
                            </span>
                        )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {project.status && (
                                <span
                                    className={`rounded-md px-2 py-0.5 font-medium ${getProjectStatusTint(project.status)}`}
                                >
                                    {t(`projectStatus.${project.status}`)}
                                </span>
                            )}
                            {dueText && (
                                <span
                                    className={
                                        daysLeft !== null && daysLeft < 0
                                            ? 'font-semibold text-red-600 dark:text-red-400'
                                            : ''
                                    }
                                >
                                    {dueText}
                                </span>
                            )}
                            {startDate && (
                                <>
                                    {dueText && <span>·</span>}
                                    <span>
                                        {t(
                                            'project.startedOn',
                                            'Started {{date}}',
                                            {
                                                date: format(
                                                    startDate,
                                                    'MMM d, yyyy'
                                                ),
                                            }
                                        )}
                                    </span>
                                </>
                            )}
                        </div>
                        <h1 className="line-clamp-2 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl dark:text-gray-100">
                            {project.name}
                        </h1>
                        {project.description && (
                            <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                {project.description}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        {onTogglePin && (
                            <button
                                type="button"
                                onClick={onTogglePin}
                                className={actionClass}
                                aria-pressed={!!project.pin_to_sidebar}
                            >
                                {project.pin_to_sidebar ? (
                                    <StarSolidIcon className="h-4 w-4 text-amber-500" />
                                ) : (
                                    <StarIcon className="h-4 w-4" />
                                )}
                                {project.pin_to_sidebar
                                    ? t('project.pinned', 'Pinned')
                                    : t('project.pin', 'Pin')}
                            </button>
                        )}
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
                            {t('projectItem.edit', 'Edit')}
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setMenuOpen((v) => !v)}
                                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                aria-label={t(
                                    'project.moreOptions',
                                    'More options'
                                )}
                                aria-expanded={menuOpen}
                            >
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md bg-white py-1 shadow-lg dark:bg-gray-800">
                                    {onSaveAsTemplate && (
                                        <button
                                            type="button"
                                            className={menuItemClass}
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onSaveAsTemplate();
                                            }}
                                        >
                                            {t(
                                                'projectItem.saveAsTemplate',
                                                'Save as Template'
                                            )}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDeleteClick();
                                        }}
                                    >
                                        {t('common.delete', 'Delete')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className="space-y-2"
                    title={
                        timeUsed !== null
                            ? t(
                                  'project.progressHint',
                                  'Bar: tasks done. Line: time passed between start and due date.'
                              )
                            : undefined
                    }
                >
                    <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        <span>
                            {t(
                                'project.progressSummary',
                                'Project progress · {{done}} of {{total}} tasks done',
                                {
                                    done: doneCount,
                                    total: totalCount,
                                }
                            )}
                            {timeUsed !== null &&
                                ` · ${t('project.timeUsed', '{{percent}}% of time used', { percent: timeUsed })}`}
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
                        {timeUsed !== null && (
                            <div
                                className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-gray-900/50 dark:bg-gray-100/50"
                                style={{ left: `${timeUsed}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectHero;
