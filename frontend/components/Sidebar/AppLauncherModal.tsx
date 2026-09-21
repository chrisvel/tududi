import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    CalendarDaysIcon,
    CalendarIcon,
    ChartBarIcon,
    ClockIcon,
    FireIcon,
    FlagIcon,
    FolderIcon,
    InboxIcon,
    LightBulbIcon,
    ListBulletIcon,
    QueueListIcon,
    RectangleGroupIcon,
    RectangleStackIcon,
    ShieldCheckIcon,
    Squares2X2Icon,
    TagIcon,
    UserGroupIcon,
    UserIcon,
    UsersIcon,
    ViewColumnsIcon,
} from '@heroicons/react/24/solid';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';

interface AppLauncherModalProps {
    isOpen: boolean;
    isAdmin?: boolean;
    onClose: () => void;
    onSelect: (path: string, title: string) => void;
}

interface LauncherEntry {
    id: string;
    path: string;
    title: string;
    Icon: React.ComponentType<{ className?: string }>;
    gradient: string;
}

const AppLauncherModal: React.FC<AppLauncherModalProps> = ({
    isOpen,
    isAdmin = false,
    onClose,
    onSelect,
}) => {
    const { t } = useTranslation();
    const firstTileRef = useRef<HTMLButtonElement>(null);
    const calendarEnabled = useStore(
        (state) => state.userSettingsStore.calendarEnabled
    );
    const habitsEnabled = useStore(
        (state) => state.userSettingsStore.habitsEnabled
    );
    const eisenhowerEnabled = useStore(
        (state) => state.userSettingsStore.eisenhowerEnabled
    );
    const kanbanEnabled = useStore(
        (state) => state.userSettingsStore.kanbanEnabled
    );
    const templatesEnabled = useStore(
        (state) => state.userSettingsStore.templatesEnabled
    );
    const hasCollaborators = useStore(
        (state) => state.userSettingsStore.hasCollaborators
    );

    const entries = useMemo<LauncherEntry[]>(() => {
        const all: Array<LauncherEntry | false> = [
            {
                id: 'inbox',
                path: '/inbox',
                title: t('sidebar.inbox', 'Inbox'),
                Icon: InboxIcon,
                gradient: 'from-sky-400 to-blue-600',
            },
            {
                id: 'today',
                path: '/today',
                title: t('sidebar.today', 'Today'),
                Icon: CalendarDaysIcon,
                gradient: 'from-orange-400 to-red-500',
            },
            {
                id: 'upcoming',
                path: '/upcoming?status=active',
                title: t('sidebar.upcoming', 'Upcoming'),
                Icon: ClockIcon,
                gradient: 'from-violet-400 to-purple-600',
            },
            calendarEnabled && {
                id: 'calendar',
                path: '/calendar',
                title: t('sidebar.calendar', 'Calendar'),
                Icon: CalendarIcon,
                gradient: 'from-rose-400 to-red-600',
            },
            {
                id: 'tasks',
                path: '/tasks?status=active',
                title: t('sidebar.allTasks', 'All Tasks'),
                Icon: ListBulletIcon,
                gradient: 'from-emerald-400 to-green-600',
            },
            {
                id: 'assigned-to-me',
                path: '/tasks?assigned_to=me&status=active',
                title: t('sidebar.assignedToMe', 'Assigned to me'),
                Icon: UserIcon,
                gradient: 'from-teal-400 to-cyan-600',
            },
            hasCollaborators && {
                id: 'everyone',
                path: '/everyone',
                title: t('sidebar.everyone', 'Everyone'),
                Icon: UsersIcon,
                gradient: 'from-indigo-400 to-blue-700',
            },
            {
                id: 'projects',
                path: '/projects',
                title: t('sidebar.projects', 'Projects'),
                Icon: FolderIcon,
                gradient: 'from-blue-500 to-indigo-600',
            },
            {
                id: 'areas',
                path: '/areas',
                title: t('sidebar.areas', 'Areas'),
                Icon: Squares2X2Icon,
                gradient: 'from-fuchsia-400 to-purple-600',
            },
            {
                id: 'goals',
                path: '/goals',
                title: t('sidebar.goals', 'Goals'),
                Icon: FlagIcon,
                gradient: 'from-rose-400 to-pink-600',
            },
            {
                id: 'notes',
                path: '/notes',
                title: t('sidebar.notes', 'Notes'),
                Icon: BookOpenIcon,
                gradient: 'from-yellow-400 to-amber-500',
            },
            {
                id: 'tags',
                path: '/tags',
                title: t('sidebar.tags', 'Tags'),
                Icon: TagIcon,
                gradient: 'from-lime-400 to-green-600',
            },
            {
                id: 'people',
                path: '/people',
                title: t('sidebar.people', 'People'),
                Icon: UserGroupIcon,
                gradient: 'from-cyan-400 to-sky-600',
            },
            habitsEnabled && {
                id: 'habits',
                path: '/habits',
                title: t('sidebar.habits', 'Habits'),
                Icon: FireIcon,
                gradient: 'from-orange-400 to-red-600',
            },
            {
                id: 'views',
                path: '/views',
                title: t('sidebar.views', 'Views'),
                Icon: QueueListIcon,
                gradient: 'from-slate-400 to-slate-600',
            },
            eisenhowerEnabled && {
                id: 'eisenhower',
                path: '/boards/eisenhower',
                title: t('sidebar.eisenhower', 'Eisenhower Matrix'),
                Icon: RectangleGroupIcon,
                gradient: 'from-red-400 to-rose-600',
            },
            kanbanEnabled && {
                id: 'kanban',
                path: '/boards/kanban',
                title: t('sidebar.kanban', 'Kanban Board'),
                Icon: ViewColumnsIcon,
                gradient: 'from-indigo-400 to-violet-600',
            },
            {
                id: 'productivity',
                path: '/insights/productivity',
                title: t(
                    'sidebar.productivityAssistant',
                    'Productivity Assistant'
                ),
                Icon: LightBulbIcon,
                gradient: 'from-yellow-300 to-orange-500',
            },
            {
                id: 'reports',
                path: '/insights/reports',
                title: t('sidebar.reports', 'Reports'),
                Icon: ChartBarIcon,
                gradient: 'from-emerald-400 to-teal-600',
            },
            templatesEnabled && {
                id: 'templates',
                path: '/templates',
                title: t('navigation.templates', 'Templates'),
                Icon: RectangleStackIcon,
                gradient: 'from-pink-400 to-fuchsia-600',
            },
            isAdmin && {
                id: 'access',
                path: '/admin/users',
                title: t('admin.access.title', 'Access'),
                Icon: ShieldCheckIcon,
                gradient: 'from-slate-500 to-zinc-700',
            },
        ];
        return all.filter((entry): entry is LauncherEntry => entry !== false);
    }, [
        t,
        calendarEnabled,
        habitsEnabled,
        eisenhowerEnabled,
        kanbanEnabled,
        templatesEnabled,
        hasCollaborators,
        isAdmin,
    ]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        firstTileRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
            data-testid="app-launcher-backdrop"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-launcher-title"
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-8">
                    <h2
                        id="app-launcher-title"
                        className="text-xl font-semibold text-gray-900 dark:text-white"
                    >
                        {t('sidebar.allEntities', 'All entities')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-7">
                    {entries.map(
                        ({ id, path, title, Icon, gradient }, index) => (
                            <li key={id}>
                                <button
                                    type="button"
                                    ref={index === 0 ? firstTileRef : undefined}
                                    onClick={() => onSelect(path, title)}
                                    data-testid={`app-launcher-${id}`}
                                    className="group w-full flex flex-col items-center gap-2 rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <span
                                        className={`flex items-center justify-center h-16 w-16 rounded-[22px] bg-gradient-to-br ${gradient} text-white shadow-md ring-1 ring-inset ring-white/20 transition duration-150 group-hover:scale-105 group-hover:shadow-lg group-active:scale-95`}
                                    >
                                        <Icon className="h-8 w-8 drop-shadow-sm" />
                                    </span>
                                    <span className="text-[13px] font-medium text-center text-gray-700 dark:text-gray-200 leading-tight line-clamp-2">
                                        {title}
                                    </span>
                                </button>
                            </li>
                        )
                    )}
                </ul>
            </div>
        </div>,
        document.body
    );
};

export default AppLauncherModal;
