import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CheckCircleIcon as CheckCircleSolidIcon,
    EllipsisVerticalIcon,
} from '@heroicons/react/24/solid';
import {
    EllipsisHorizontalCircleIcon,
    ClipboardDocumentListIcon,
    PlayIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import { Project, ProjectStatus } from '../../entities/Project';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import { getCurrentUser } from '../../utils/userUtils';
import Tooltip from '../Shared/Tooltip';
import EntityCard from '../Shared/EntityCard';
import { PROJECT_TABLE_GRID } from './projectTableLayout';
import { getProjectStatusTint } from './projectStatusStyles';
import { avatarTint } from '../../utils/avatarTint';
import { differenceInCalendarDays } from 'date-fns';
import { listShares, ListSharesResponseRow } from '../../utils/sharesService';
import {
    failedShareCache,
    projectShareCache,
} from '../../utils/projectShareCache';
import { getApiPath } from '../../config/paths';

interface ProjectItemProps {
    project: Project;
    viewMode: 'cards' | 'list';
    getCompletionPercentage: () => number;
    activeDropdown: number | null;
    setActiveDropdown: React.Dispatch<React.SetStateAction<number | null>>;
    handleEditProject: (project: Project) => void;
    setProjectToDelete: React.Dispatch<React.SetStateAction<Project | null>>;
    setIsConfirmDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onOpenShare: (project: Project) => void;
    onStatusChange: (
        project: Project,
        newStatus: ProjectStatus
    ) => Promise<void>;
    onSaveAsTemplate?: (project: Project) => void;
}

const getStatusIcon = (status: ProjectStatus | undefined) => {
    switch (status) {
        case 'not_started':
            return { icon: EllipsisHorizontalCircleIcon };
        case 'planned':
            return { icon: ClipboardDocumentListIcon };
        case 'in_progress':
            return { icon: PlayIcon };
        case 'waiting':
            return { icon: ClockIcon };
        case 'done':
            return { icon: CheckCircleIcon };
        case 'cancelled':
            return { icon: XCircleIcon };
        default:
            return { icon: EllipsisHorizontalCircleIcon };
    }
};

const getStatusLabel = (status: ProjectStatus | undefined, t: any): string => {
    switch (status) {
        case 'not_started':
            return t('projectStatus.not_started', 'Not Started');
        case 'planned':
            return t('projectStatus.planned', 'Planned');
        case 'in_progress':
            return t('projectStatus.in_progress', 'In Progress');
        case 'waiting':
            return t('projectStatus.waiting', 'Waiting');
        case 'done':
            return t('projectStatus.done', 'Completed');
        case 'cancelled':
            return t('projectStatus.cancelled', 'Cancelled');
        default:
            return t('projectStatus.not_started', 'Not Started');
    }
};

const MAX_SHARE_AVATARS = 4;

const getShareInitials = (value?: string | null) => {
    if (!value) return '?';
    const cleaned = value
        .replace(/@.*/, '')
        .split(/[\s._-]+/)
        .filter((part) => part.length > 0)
        .map((part) => part[0].toUpperCase())
        .join('');
    return cleaned.substring(0, 2) || '?';
};

const ProjectItem: React.FC<ProjectItemProps> = ({
    project,
    viewMode,
    getCompletionPercentage,
    activeDropdown,
    setActiveDropdown,
    handleEditProject,
    setProjectToDelete,
    setIsConfirmDialogOpen,
    onOpenShare,
    onStatusChange,
    onSaveAsTemplate,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const currentUser = getCurrentUser();
    const isOwner =
        currentUser && (project as any).user_uid === currentUser.uid;
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const descriptionText = project.description?.trim();
    const projectPath = project.uid
        ? `/project/${project.uid}-${project.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')}`
        : `/project/${project.id}`;
    const statusOptions: {
        value: ProjectStatus;
        label: string;
        Icon: React.ElementType;
    }[] = [
        {
            value: 'not_started',
            label: t('projectStatus.not_started', 'Not Started'),
            Icon: EllipsisHorizontalCircleIcon,
        },
        {
            value: 'planned',
            label: t('projectStatus.planned', 'Planned'),
            Icon: ClipboardDocumentListIcon,
        },
        {
            value: 'in_progress',
            label: t('projectStatus.in_progress', 'In Progress'),
            Icon: PlayIcon,
        },
        {
            value: 'waiting',
            label: t('projectStatus.waiting', 'Waiting'),
            Icon: ClockIcon,
        },
        {
            value: 'done',
            label: t('projectStatus.done', 'Completed'),
            Icon: CheckCircleIcon,
        },
        {
            value: 'cancelled',
            label: t('projectStatus.cancelled', 'Cancelled'),
            Icon: XCircleIcon,
        },
    ];

    useEffect(() => {
        if (!statusDropdownOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (
                statusDropdownRef.current &&
                !statusDropdownRef.current.contains(e.target as Node)
            ) {
                setStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () =>
            document.removeEventListener('mousedown', handleOutsideClick);
    }, [statusDropdownOpen]);

    const [sharedUsers, setSharedUsers] = useState<
        ListSharesResponseRow[] | null
    >(() => {
        if (project.uid && projectShareCache.has(project.uid)) {
            return projectShareCache.get(project.uid) || null;
        }
        return null;
    });

    useEffect(() => {
        if (project.uid && projectShareCache.has(project.uid)) {
            setSharedUsers(projectShareCache.get(project.uid) || null);
        } else if (!project.is_shared) {
            setSharedUsers(null);
        }
    }, [project.uid, project.is_shared]);

    useEffect(() => {
        if (
            !project.is_shared ||
            !project.uid ||
            projectShareCache.has(project.uid) ||
            failedShareCache.has(project.uid)
        ) {
            return;
        }

        let isMounted = true;
        listShares('project', project.uid)
            .then((rows) => {
                if (!isMounted) return;
                const filtered = rows.filter((row) => !row.is_owner);
                projectShareCache.set(project.uid as string, filtered);
                setSharedUsers(filtered);
            })
            .catch((error) => {
                if (!isMounted) return;
                failedShareCache.add(project.uid as string);
                console.error(
                    'Failed to fetch shares for project',
                    project.uid,
                    error
                );
            });

        return () => {
            isMounted = false;
        };
    }, [project.uid, project.is_shared]);

    const dueInfo = useMemo(() => {
        if (!project.due_date_at) {
            return {
                text: t('projectItem.noDueDate', 'No due date'),
                isOverdue: false,
            };
        }
        const isFinished =
            project.status === 'done' || project.status === 'cancelled';
        const dueDate = new Date(project.due_date_at);
        if (Number.isNaN(dueDate.getTime())) {
            return {
                text: t('projectItem.noDueDate', 'No due date'),
                isOverdue: false,
            };
        }
        const diff = differenceInCalendarDays(dueDate, new Date());
        if (diff === 0) {
            return {
                text: t('projectItem.dueToday', 'Due today'),
                isOverdue: false,
            };
        }

        const unit =
            Math.abs(diff) === 1
                ? t('projectItem.day', 'day')
                : t('projectItem.days', 'days');

        if (diff > 0) {
            return {
                text: t('projectItem.dueIn', 'Due in {{count}} {{unit}}', {
                    count: diff,
                    unit,
                }),
                isOverdue: false,
            };
        }

        return {
            text: t('projectItem.overdue', 'Overdue {{count}} {{unit}} ago', {
                count: Math.abs(diff),
                unit,
            }),
            isOverdue: !isFinished,
        };
    }, [project.due_date_at, project.status, t]);

    const shareAvatars = useMemo(() => {
        if (!project.is_shared) {
            return {
                avatars: [] as ListSharesResponseRow[],
                remaining: 0,
            };
        }

        const knownShares = sharedUsers ?? [];
        const avatars = knownShares.slice(0, MAX_SHARE_AVATARS);
        // The share list only names people invited directly, while
        // share_count also includes members who got access through a group.
        const totalCount = Math.max(
            sharedUsers?.length ?? 0,
            project.share_count ?? 0
        );
        const remaining = Math.max(0, totalCount - avatars.length);

        return { avatars, remaining };
    }, [project.is_shared, project.share_count, sharedUsers]);

    const getShareDisplayName = (email?: string | null) => {
        if (!email) {
            return t('projectItem.sharedUser', 'Shared user');
        }
        const [namePart] = email.split('@');
        if (!namePart) return email;
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    };
    const taskStatus = (project as any).task_status as
        { done: number; total: number } | undefined;
    const area = (project as any).Area ?? project.area;
    const { icon: StatusIcon } = getStatusIcon(project.status);

    const toggleActions = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setStatusDropdownOpen(false);
        if (project.id !== undefined) {
            setActiveDropdown(
                activeDropdown === project.id ? null : project.id
            );
        }
    };

    const menuItemClass =
        'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left';

    const actionsMenu = (
        <div className="relative dropdown-container">
            <button
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-800 opacity-60 group-hover:opacity-100 focus:opacity-100 focus:outline-none transition"
                onClick={toggleActions}
                aria-label={t('projectItem.toggleDropdownMenu')}
                data-testid={`project-dropdown-${project.id}`}
            >
                <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            {project.id !== undefined && activeDropdown === project.id && (
                <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md z-30">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveDropdown(null);
                            if (!isOwner) {
                                showErrorToast(
                                    t(
                                        'errors.permissionDenied',
                                        'Permission denied'
                                    )
                                );
                                return;
                            }
                            handleEditProject(project);
                        }}
                        className={menuItemClass}
                        data-testid={`project-edit-${project.id}`}
                    >
                        {t('projectItem.edit')}
                    </button>
                    {isOwner && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onOpenShare(project);
                                setActiveDropdown(null);
                            }}
                            className={menuItemClass}
                            data-testid={`project-share-list-${project.id}`}
                        >
                            {t('projectItem.share', 'Share')}
                        </button>
                    )}
                    {isOwner && onSaveAsTemplate && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSaveAsTemplate(project);
                                setActiveDropdown(null);
                            }}
                            className={menuItemClass}
                        >
                            {t(
                                'projectItem.saveAsTemplate',
                                'Save as Template'
                            )}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveDropdown(null);
                            if (
                                project.id === undefined ||
                                project.id === null
                            ) {
                                console.error(
                                    'Cannot delete project: Invalid ID',
                                    project
                                );
                                return;
                            }
                            setProjectToDelete(project);
                            setIsConfirmDialogOpen(true);
                        }}
                        className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                        data-testid={`project-delete-${project.id}`}
                    >
                        {t('projectItem.delete')}
                    </button>
                </div>
            )}
        </div>
    );

    const renderStatusPicker = (
        trigger: React.ReactNode,
        triggerClass: string,
        menuPosition: string
    ) => (
        <div className="relative flex-shrink-0" ref={statusDropdownRef}>
            <button
                className={triggerClass}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStatusDropdownOpen((prev) => !prev);
                    setActiveDropdown(null);
                }}
                aria-label={t('projectItem.changeStatus', 'Change status')}
            >
                {trigger}
            </button>
            {statusDropdownOpen && (
                <div
                    className={`absolute ${menuPosition} z-50 min-w-[10rem] bg-white dark:bg-gray-800 shadow-xl rounded-md overflow-hidden`}
                >
                    {statusOptions.map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onStatusChange(project, value);
                                setStatusDropdownOpen(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm w-full text-left transition-colors ${
                                project.status === value
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderMembers = (size: string, ring: string) =>
        project.is_shared &&
        (shareAvatars.avatars.length > 0 || shareAvatars.remaining > 0) ? (
            <div className="flex items-center gap-1">
                {shareAvatars.avatars.map((share) => (
                    <Tooltip
                        key={`${project.uid}-${share.user_id}`}
                        content={
                            share.email
                                ? getShareDisplayName(share.email)
                                : t('projectItem.sharedUser', 'Shared user')
                        }
                    >
                        {share.avatar_image ? (
                            <img
                                src={getApiPath(share.avatar_image)}
                                alt={getShareDisplayName(share.email)}
                                className={`${size} rounded-full object-cover ring-2 ${ring}`}
                            />
                        ) : (
                            <span
                                className={`inline-flex ${size} items-center justify-center rounded-full text-[10px] font-semibold ring-2 ${ring} ${avatarTint(
                                    share.email || String(share.user_id)
                                )}`}
                            >
                                {getShareInitials(share.email)}
                            </span>
                        )}
                    </Tooltip>
                ))}
                {shareAvatars.remaining > 0 && (
                    <Tooltip
                        content={t(
                            'projectItem.moreSharedUsers',
                            '+{{count}} more users',
                            { count: shareAvatars.remaining }
                        )}
                    >
                        <span
                            className={`inline-flex ${size} items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200 ring-2 ${ring}`}
                        >
                            +{shareAvatars.remaining}
                        </span>
                    </Tooltip>
                )}
            </div>
        ) : null;

    if (viewMode === 'cards') {
        return (
            <EntityCard
                to={projectPath}
                title={project.name}
                description={descriptionText}
                testId={`project-card-${project.id}`}
                actions={actionsMenu}
                progress={{
                    done: taskStatus?.done ?? 0,
                    total: taskStatus?.total ?? 0,
                    title: t('projectItem.completionPercentage', {
                        percentage: getCompletionPercentage(),
                    }),
                }}
                details={
                    <>
                        {dueInfo.isOverdue ? (
                            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                <ExclamationTriangleIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{dueInfo.text}</span>
                            </span>
                        ) : (
                            <span className="truncate">{dueInfo.text}</span>
                        )}
                        {renderStatusPicker(
                            <>
                                <StatusIcon className="h-3.5 w-3.5" />
                                <span>{getStatusLabel(project.status, t)}</span>
                            </>,
                            'flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors',
                            'right-0 bottom-full mb-1'
                        )}
                    </>
                }
                people={renderMembers(
                    'h-7 w-7',
                    'ring-gray-50 dark:ring-gray-900'
                )}
                pill={
                    area?.name ? { label: area.name, color: area.color } : null
                }
            />
        );
    }

    const percent = getCompletionPercentage();
    const isComplete = percent >= 100 && (taskStatus?.total ?? 0) > 0;

    return (
        <div
            className={`${PROJECT_TABLE_GRID} group px-4 py-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors`}
            data-testid={`project-row-${project.id}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <Link
                    to={projectPath}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    style={
                        !project.image_url && project.color
                            ? {
                                  backgroundColor: `color-mix(in srgb, ${project.color} 18%, transparent)`,
                                  color: project.color,
                              }
                            : undefined
                    }
                    tabIndex={-1}
                    aria-hidden="true"
                >
                    {project.image_url ? (
                        <img
                            src={project.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <FolderIcon className="h-5 w-5" />
                    )}
                </Link>
                <div className="min-w-0">
                    <Link
                        to={projectPath}
                        title={project.name}
                        className="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-gray-100"
                    >
                        {project.name}
                    </Link>
                    {area?.name && (
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {area.name}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex">
                {renderStatusPicker(
                    getStatusLabel(project.status, t),
                    `rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity hover:opacity-80 ${getProjectStatusTint(project.status)}`,
                    'left-0 top-full mt-1'
                )}
            </div>

            <div className="hidden min-w-0 xl:block">
                {descriptionText ? (
                    <p
                        className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
                        title={descriptionText}
                    >
                        {descriptionText}
                    </p>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                        –
                    </span>
                )}
            </div>

            <div className="hidden min-w-0 lg:flex">
                {renderMembers(
                    'h-6 w-6',
                    'ring-gray-50 dark:ring-gray-900'
                ) ?? (
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                        –
                    </span>
                )}
            </div>

            <div
                className={`hidden truncate text-xs md:block ${
                    dueInfo.isOverdue
                        ? 'font-semibold text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                }`}
                title={dueInfo.text}
            >
                {dueInfo.text}
            </div>

            <div
                className="hidden items-center gap-2 md:flex"
                title={
                    taskStatus
                        ? `${taskStatus.done}/${taskStatus.total}`
                        : undefined
                }
            >
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${
                            isComplete ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                {isComplete ? (
                    <CheckCircleSolidIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                    <span className="w-8 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {percent}%
                    </span>
                )}
            </div>

            <div className="flex justify-end">{actionsMenu}</div>
        </div>
    );
};

export default ProjectItem;
