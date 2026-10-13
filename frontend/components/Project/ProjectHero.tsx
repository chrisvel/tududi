import React, { useEffect, useRef, useState } from 'react';
import { TFunction } from 'i18next';
import { differenceInCalendarDays, format } from 'date-fns';
import {
    CameraIcon,
    CheckIcon,
    ChevronDownIcon,
    EllipsisHorizontalIcon,
    FolderIcon,
    ShareIcon,
    StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Project, ProjectStatus } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { getAssetPath } from '../../config/paths';
import { getProjectStatusTint } from './projectStatusStyles';

const PROJECT_STATUSES: ProjectStatus[] = [
    'not_started',
    'planned',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
];
const MAX_NAME_LENGTH = 150;

interface ProjectHeroProps {
    project: Project;
    areas: Area[];
    t: TFunction;
    doneCount: number;
    totalCount: number;
    onUpdate: (patch: Partial<Project>) => Promise<void>;
    onDeleteClick: () => void;
    onShareClick: () => void;
    onSaveAsTemplate?: () => void;
    onEditBannerClick?: () => void;
    onTogglePin?: () => void;
}

const ProjectHero: React.FC<ProjectHeroProps> = ({
    project,
    t,
    doneCount,
    totalCount,
    onUpdate,
    onDeleteClick,
    onShareClick,
    onSaveAsTemplate,
    onEditBannerClick,
    onTogglePin,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [statusOpen, setStatusOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);

    // The name and description edit in place: click to edit, Enter (or
    // Cmd/Ctrl+Enter for the description) or leaving the field saves, Esc
    // puts the saved value back.
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(project.name);
    const nameRef = useRef<HTMLInputElement>(null);
    const [editingDescription, setEditingDescription] = useState(false);
    const [descriptionDraft, setDescriptionDraft] = useState(
        project.description || ''
    );
    const descriptionRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!editingName) setNameDraft(project.name);
    }, [project.name, editingName]);

    useEffect(() => {
        if (!editingDescription) setDescriptionDraft(project.description || '');
    }, [project.description, editingDescription]);

    useEffect(() => {
        if (editingName) nameRef.current?.select();
    }, [editingName]);

    useEffect(() => {
        if (!editingDescription) return;
        const el = descriptionRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [editingDescription]);

    useEffect(() => {
        if (!menuOpen && !statusOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setMenuOpen(false);
            }
            if (statusRef.current && !statusRef.current.contains(target)) {
                setStatusOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen, statusOpen]);

    const saveName = async () => {
        const next = nameDraft.trim();
        setEditingName(false);
        if (!next || next.length > MAX_NAME_LENGTH || next === project.name) {
            setNameDraft(project.name);
            return;
        }
        try {
            await onUpdate({ name: next });
        } catch {
            setNameDraft(project.name);
        }
    };

    const saveDescription = async () => {
        const next = descriptionDraft.trim();
        setEditingDescription(false);
        if (next === (project.description || '')) {
            setDescriptionDraft(project.description || '');
            return;
        }
        try {
            await onUpdate({ description: next });
        } catch {
            setDescriptionDraft(project.description || '');
        }
    };

    const changeStatus = async (status: ProjectStatus) => {
        setStatusOpen(false);
        if (status === project.status) return;
        await onUpdate({ status }).catch(() => undefined);
    };

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
                            <div className="relative" ref={statusRef}>
                                <button
                                    type="button"
                                    onClick={() => setStatusOpen((v) => !v)}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-opacity hover:opacity-80 ${getProjectStatusTint(project.status || 'not_started')}`}
                                    aria-haspopup="menu"
                                    aria-expanded={statusOpen}
                                    data-testid="project-status-trigger"
                                >
                                    {t(
                                        `projectStatus.${project.status || 'not_started'}`
                                    )}
                                    <ChevronDownIcon className="h-3 w-3" />
                                </button>
                                {statusOpen && (
                                    <div
                                        role="menu"
                                        className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-md bg-white py-1 shadow-lg dark:bg-gray-800"
                                    >
                                        {PROJECT_STATUSES.map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                role="menuitem"
                                                onClick={() =>
                                                    changeStatus(status)
                                                }
                                                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                                    status === project.status
                                                        ? 'text-gray-900 dark:text-gray-100'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <span
                                                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${getProjectStatusTint(status)}`}
                                                >
                                                    {t(
                                                        `projectStatus.${status}`
                                                    )}
                                                </span>
                                                {status === project.status && (
                                                    <CheckIcon className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                        {editingName ? (
                            <input
                                ref={nameRef}
                                type="text"
                                value={nameDraft}
                                maxLength={MAX_NAME_LENGTH}
                                onChange={(e) => setNameDraft(e.target.value)}
                                onBlur={saveName}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        saveName();
                                    } else if (e.key === 'Escape') {
                                        setNameDraft(project.name);
                                        setEditingName(false);
                                    }
                                }}
                                className="-mx-1 w-full rounded-md bg-white/70 px-1 text-xl font-semibold leading-tight text-gray-900 outline-none ring-2 ring-blue-500/40 sm:text-2xl dark:bg-gray-800/70 dark:text-gray-100"
                                aria-label={t('project.name', 'Project Name')}
                                data-testid="project-name-input"
                            />
                        ) : (
                            <h1
                                onClick={() => setEditingName(true)}
                                title={t(
                                    'project.clickToEdit',
                                    'Click to edit'
                                )}
                                className="-mx-1 line-clamp-2 cursor-text rounded-md px-1 text-xl font-semibold leading-tight text-gray-900 transition-colors hover:bg-white/60 sm:text-2xl dark:text-gray-100 dark:hover:bg-gray-800/60"
                                data-testid="project-name"
                            >
                                {project.name}
                            </h1>
                        )}
                        {editingDescription ? (
                            <textarea
                                ref={descriptionRef}
                                value={descriptionDraft}
                                rows={Math.min(
                                    8,
                                    Math.max(
                                        2,
                                        descriptionDraft.split('\n').length
                                    )
                                )}
                                onChange={(e) =>
                                    setDescriptionDraft(e.target.value)
                                }
                                onBlur={saveDescription}
                                onKeyDown={(e) => {
                                    if (
                                        (e.metaKey || e.ctrlKey) &&
                                        e.key === 'Enter'
                                    ) {
                                        e.preventDefault();
                                        saveDescription();
                                    } else if (e.key === 'Escape') {
                                        setDescriptionDraft(
                                            project.description || ''
                                        );
                                        setEditingDescription(false);
                                    }
                                }}
                                placeholder={t(
                                    'forms.projectDescriptionPlaceholder',
                                    'Enter project description (optional)'
                                )}
                                className="-mx-1 block w-full max-w-3xl resize-none rounded-md bg-white/70 px-1 py-0.5 text-sm leading-relaxed text-gray-700 outline-none ring-2 ring-blue-500/40 dark:bg-gray-800/70 dark:text-gray-300"
                                aria-label={t(
                                    'forms.description',
                                    'Description'
                                )}
                                data-testid="project-description-input"
                            />
                        ) : (
                            <p
                                onClick={() => setEditingDescription(true)}
                                title={t(
                                    'project.clickToEdit',
                                    'Click to edit'
                                )}
                                className={`-mx-1 max-w-3xl cursor-text whitespace-pre-wrap rounded-md px-1 py-0.5 text-sm leading-relaxed transition-colors hover:bg-white/60 dark:hover:bg-gray-800/60 ${
                                    project.description
                                        ? 'text-gray-600 dark:text-gray-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                }`}
                                data-testid="project-description"
                            >
                                {project.description ||
                                    t(
                                        'project.addDescription',
                                        'Add a description'
                                    )}
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
