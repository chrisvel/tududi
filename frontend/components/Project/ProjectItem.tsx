import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import {
    PencilSquareIcon,
    TrashIcon,
    EllipsisHorizontalCircleIcon,
    ClipboardDocumentListIcon,
    PlayIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ShareIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Project, ProjectStatus } from '../../entities/Project';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import { getCurrentUser } from '../../utils/userUtils';
import Tooltip from '../Shared/Tooltip';
import { differenceInCalendarDays } from 'date-fns';
import { listShares, ListSharesResponseRow } from '../../utils/sharesService';
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
}

const getProjectInitials = (name: string, maxLetters?: number) => {
    const words = name
        .trim()
        .split(' ')
        .filter((word) => word.length > 0);

    if (words.length === 1) {
        const singleWord = name.toUpperCase();
        return maxLetters ? singleWord.substring(0, maxLetters) : singleWord;
    }

    const initials = words.map((word) => word[0].toUpperCase()).join('');
    return maxLetters ? initials.substring(0, maxLetters) : initials;
};

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

const projectShareCache = new Map<string, ListSharesResponseRow[]>();
const failedShareCache = new Set<string>();
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
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const currentUser = getCurrentUser();
    const isOwner =
        currentUser && (project as any).user_uid === currentUser.uid;
    const descriptionText = project.description?.trim();
    const listTitleClasses =
        'block w-full text-md font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate';
    const listTitleLink = (
        <Link
            to={
                project.uid
                    ? `/project/${project.uid}-${project.name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')}`
                    : `/project/${project.id}`
            }
            className={listTitleClasses}
        >
            {project.name}
        </Link>
    );
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
            isOverdue: true,
        };
    }, [project.due_date_at, t]);

    const shareAvatars = useMemo(() => {
        if (!project.is_shared) {
            return {
                avatars: [] as ListSharesResponseRow[],
                remaining: 0,
            };
        }

        const knownShares = sharedUsers ?? [];
        const avatars = knownShares.slice(0, MAX_SHARE_AVATARS);
        const totalCount =
            (sharedUsers?.length ?? project.share_count ?? avatars.length) || 0;
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
    return (
        <div
            className={`${
                viewMode === 'cards'
                    ? 'bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group'
                    : 'bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-row items-center p-4 group'
            }`}
            style={{
                minHeight: viewMode === 'cards' ? '260px' : 'auto',
                maxHeight: viewMode === 'cards' ? '260px' : 'auto',
            }}
        >
            {viewMode === 'cards' && (
                <div className="relative">
                    <Link
                        to={
                            project.uid
                                ? `/project/${project.uid}-${project.name
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]+/g, '-')
                                      .replace(/^-|-$/g, '')}`
                                : `/project/${project.id}`
                        }
                        className="block"
                    >
                        <div className="relative h-40 overflow-hidden rounded-t-lg bg-gray-200 dark:bg-gray-700">
                            {project.image_url ? (
                                <img
                                    src={project.image_url}
                                    alt={project.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-700"></div>
                            )}
                            <div className="absolute top-2 right-2 z-20 flex items-center space-x-2">
                                {project.is_shared && (
                                    <ShareIcon
                                        className="h-4 w-4 text-green-400 drop-shadow-sm"
                                        title={t(
                                            'projectItem.sharedProject',
                                            'Shared with team'
                                        )}
                                    />
                                )}
                                {(() => {
                                    const { icon: StatusIcon } = getStatusIcon(
                                        project.status
                                    );
                                    return (
                                        <StatusIcon
                                            className="h-4 w-4 text-white/80 drop-shadow-sm"
                                            title={getStatusLabel(
                                                project.status,
                                                t
                                            )}
                                        />
                                    );
                                })()}
                                <div className="relative dropdown-container">
                                    <button
                                        className="p-1.5 rounded-full bg-black/30 text-white hover:bg-black/60 focus:outline-none backdrop-blur-sm"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const projectId = project.id;
                                            if (projectId !== undefined) {
                                                setActiveDropdown(
                                                    activeDropdown === projectId
                                                        ? null
                                                        : projectId
                                                );
                                            }
                                        }}
                                        aria-label={t(
                                            'projectItem.toggleDropdownMenu'
                                        )}
                                        data-testid={`project-dropdown-${project.id}`}
                                    >
                                        <EllipsisVerticalIcon className="h-5 w-5" />
                                    </button>
                                    {project.id !== undefined &&
                                        activeDropdown === project.id && (
                                            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 shadow-lg rounded-md z-30">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!isOwner) {
                                                            showErrorToast(
                                                                t(
                                                                    'errors.permissionDenied',
                                                                    'Permission denied'
                                                                )
                                                            );
                                                            setActiveDropdown(
                                                                null
                                                            );
                                                            return;
                                                        }
                                                        handleEditProject(
                                                            project
                                                        );
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                    data-testid={`project-edit-${project.id}`}
                                                >
                                                    {t('projectItem.edit')}
                                                </button>
                                                {isOwner && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onOpenShare(
                                                                project
                                                            );
                                                            setActiveDropdown(
                                                                null
                                                            );
                                                        }}
                                                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                    >
                                                        {t(
                                                            'projectItem.share',
                                                            'Share'
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (
                                                            project.id ===
                                                                undefined ||
                                                            project.id === null
                                                        ) {
                                                            console.error(
                                                                'Cannot delete project: Invalid ID',
                                                                project
                                                            );
                                                            return;
                                                        }
                                                        setProjectToDelete(
                                                            project
                                                        );
                                                        setIsConfirmDialogOpen(
                                                            true
                                                        );
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                    data-testid={`project-delete-${project.id}`}
                                                >
                                                    {t('projectItem.delete')}
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>
            )}

            {viewMode === 'cards' && (
                <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                    <div className="space-y-0.5 flex-1">
                        <Tooltip
                            content={
                                <div className="max-w-xs space-y-1 text-white">
                                    <p className="text-sm font-semibold text-white">
                                        {project.name}
                                    </p>
                                    {descriptionText && (
                                        <p className="text-sm text-white/90">
                                            {descriptionText}
                                        </p>
                                    )}
                                </div>
                            }
                            className="w-full"
                        >
                            <Link
                                to={
                                    project.uid
                                        ? `/project/${project.uid}-${project.name
                                              .toLowerCase()
                                              .replace(/[^a-z0-9]+/g, '-')
                                              .replace(/^-|-$/g, '')}`
                                        : `/project/${project.id}`
                                }
                                className="block text-lg font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate"
                            >
                                {project.name}
                            </Link>
                        </Tooltip>
                    </div>
                    <div className="mt-auto pt-2 space-y-2">
                        <div className="flex items-center space-x-2">
                            <div
                                className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 cursor-help overflow-hidden"
                                title={
                                    (project as any).task_status
                                        ? `${(project as any).task_status.done} of ${(project as any).task_status.total} tasks completed (${getCompletionPercentage()}%)`
                                        : t(
                                              'projectItem.completionPercentage',
                                              {
                                                  percentage:
                                                      getCompletionPercentage(),
                                              }
                                          )
                                }
                            >
                                <div
                                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                    style={{
                                        width: `${getCompletionPercentage()}%`,
                                    }}
                                ></div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                {(project as any).task_status
                                    ? `${(project as any).task_status.done}/${(project as any).task_status.total}`
                                    : '0/0'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                            <div className="flex items-center min-w-0">
                                {dueInfo.isOverdue ? (
                                    <span className="inline-flex items-center space-x-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold text-[11px] leading-snug">
                                        <ExclamationTriangleIcon
                                            className="h-3 w-3 flex-shrink-0"
                                            style={{ marginTop: '1px' }}
                                        />
                                        <span>{dueInfo.text}</span>
                                    </span>
                                ) : (
                                    <span className="truncate">
                                        {dueInfo.text}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-end min-w-0 h-7">
                                {project.is_shared && (
                                    <div className="flex items-center -space-x-2 h-full">
                                        <>
                                            {shareAvatars.avatars.map(
                                                (share) => (
                                                    <Tooltip
                                                        key={`${project.uid}-${share.user_id}`}
                                                        content={
                                                            share.email
                                                                ? getShareDisplayName(
                                                                      share.email
                                                                  )
                                                                : t(
                                                                      'projectItem.sharedUser',
                                                                      'Shared user'
                                                                  )
                                                        }
                                                    >
                                                        {share.avatar_image ? (
                                                            <img
                                                                src={getApiPath(
                                                                    share.avatar_image
                                                                )}
                                                                alt={getShareDisplayName(
                                                                    share.email
                                                                )}
                                                                className="h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm dark:border-gray-900"
                                                            />
                                                        ) : (
                                                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-semibold text-white shadow-sm dark:border-gray-900">
                                                                {getShareInitials(
                                                                    share.email
                                                                )}
                                                            </span>
                                                        )}
                                                    </Tooltip>
                                                )
                                            )}
                                            {shareAvatars.remaining > 0 && (
                                                <Tooltip
                                                    content={t(
                                                        'projectItem.moreSharedUsers',
                                                        '+{{count}} more users',
                                                        {
                                                            count: shareAvatars.remaining,
                                                        }
                                                    )}
                                                >
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-semibold text-gray-700 shadow-sm dark:border-gray-900 dark:bg-gray-700 dark:text-gray-200">
                                                        +
                                                        {shareAvatars.remaining}
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'list' && (
                <Link
                    to={
                        project.uid
                            ? `/project/${project.uid}-${project.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '')}`
                            : `/project/${project.id}`
                    }
                    className="w-10 h-10 mr-3 flex-shrink-0"
                >
                    {project.image_url ? (
                        <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-full h-full object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                            <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400 opacity-20">
                                {getProjectInitials(project.name, 2)}
                            </span>
                        </div>
                    )}
                </Link>
            )}

            {viewMode === 'list' && (
                <div className="flex justify-between items-center flex-1">
                    <div className="flex items-center min-w-0">
                        {listTitleLink}
                    </div>
                    <div className="relative dropdown-container">
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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
                                className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                                data-testid={`project-edit-list-${project.id}`}
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            {isOwner && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenShare(project);
                                    }}
                                    className={`transition-colors duration-200 ${
                                        project.is_shared
                                            ? 'text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-500'
                                            : 'text-gray-500 hover:text-green-600 dark:hover:text-green-400'
                                    }`}
                                    data-testid={`project-share-list-${project.id}`}
                                >
                                    <ShareIcon className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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
                                className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                                data-testid={`project-delete-list-${project.id}`}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectItem;
