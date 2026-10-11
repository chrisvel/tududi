import React, { useEffect } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    ListBulletIcon,
    ClockIcon,
    CalendarIcon,
    UserIcon,
    UsersIcon,
    PuzzlePieceIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { useOptionalPluginHost } from '../../plugins/context';
import { useDailyPlanProgress } from '../../store/dailyPlanStore';
import { loadInboxItemsToStore } from '../../utils/inboxService';
import { SidebarLinkId, sortByOrder } from '../../utils/sidebarLayout';

interface SidebarNavProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openTaskModal: () => void;
    // Icons only, for the collapsed sidebar rail
    compact?: boolean;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    handleNavClick,
    location,
    compact = false,
}) => {
    const { t } = useTranslation();
    const store = useStore();
    const calendarEnabled = useStore(
        (state) => state.userSettingsStore.calendarEnabled
    );
    const hasCollaborators = useStore(
        (state) => state.userSettingsStore.hasCollaborators
    );
    const visibleSections = useStore(
        (state) => state.userSettingsStore.sidebarVisibleSections
    );

    const linkOrder = useStore(
        (state) => state.userSettingsStore.sidebarLinkOrder
    );

    const inboxItemsCount = store.inboxStore.pagination.total;
    const planProgress = useDailyPlanProgress((state) => state.progress);

    useEffect(() => {
        loadInboxItemsToStore(false).catch(console.error);
    }, []);

    const allNavLinks = [
        {
            id: 'inbox',
            path: '/inbox',
            title: t('sidebar.inbox', 'Inbox'),
            icon: <InboxIcon className="h-[15px] w-[15px]" />,
        },
        {
            id: 'today',
            path: '/today',
            title: t('sidebar.today', 'Today'),
            icon: <CalendarDaysIcon className="h-[15px] w-[15px]" />,
            query: 'type=today',
        },
        {
            id: 'upcomingTasks',
            path: '/upcoming?status=active',
            title: t('sidebar.upcoming', 'Upcoming'),
            icon: <ClockIcon className="h-[15px] w-[15px]" />,
        },
        {
            id: 'calendar',
            path: '/calendar',
            title: t('sidebar.calendar', 'Calendar'),
            icon: <CalendarIcon className="h-[15px] w-[15px]" />,
        },
        {
            id: 'allTasks',
            path: '/tasks?status=active',
            title: t('sidebar.allTasks', 'All Tasks'),
            icon: <ListBulletIcon className="h-[15px] w-[15px]" />,
            query: 'status=active',
        },
        {
            id: 'assignedToMe',
            path: '/tasks?assigned_to=me&status=active',
            title: t('sidebar.assignedToMe', 'Assigned to me'),
            icon: <UserIcon className="h-[15px] w-[15px]" />,
            query: 'assigned_to=me',
        },
        {
            id: 'everyone',
            path: '/everyone',
            title: t('sidebar.everyone', 'Everyone'),
            icon: <UsersIcon className="h-[15px] w-[15px]" />,
        },
    ];

    // Optional: the sidebar also renders in tests and in startup paths that
    // mount no plugin host, where it must simply contribute nothing.
    const pluginHost = useOptionalPluginHost();
    const pluginSnapshot = pluginHost?.snapshot;

    const navLinks = sortByOrder(
        allNavLinks.filter((link) => {
            if (link.id === 'calendar' && !calendarEnabled) return false;
            if (link.id === 'everyone' && !hasCollaborators) return false;
            if (visibleSections[link.id as SidebarLinkId] === false)
                return false;
            // A plugin may hide an item (calm mode reduces navigation) but the
            // item and its route still exist.
            return pluginHost
                ? pluginHost.registry.isNavItemVisible({
                      path: link.path,
                      section: 'nav',
                  })
                : true;
        }),
        linkOrder
    );

    const pluginNavLinks = (pluginSnapshot?.routes || [])
        .filter(
            (route) =>
                route.nav &&
                (!pluginHost ||
                    pluginHost.registry.isNavItemVisible({
                        path: route.path,
                        section: 'plugin',
                    }))
        )
        .sort((a, b) => (a.nav?.order ?? 100) - (b.nav?.order ?? 100));

    const renderPluginIcon = (
        route: (typeof pluginNavLinks)[number]
    ): JSX.Element => {
        const Icon = route.nav?.icon || PuzzlePieceIcon;
        return <Icon className="h-[15px] w-[15px]" />;
    };

    const activeClass =
        'bg-blue-50 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(90%_0.01_250)] font-semibold hover:bg-blue-100 dark:hover:bg-[oklch(27%_0.02_250)]';
    const inactiveClass =
        'text-gray-700 dark:text-[oklch(75%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)]';

    const isActiveLink = (path: string, query?: string): boolean => {
        // Plugin pages are all under one namespace, so an exact match is right.
        if (path.startsWith('/plugins/')) {
            return location.pathname === path;
        }
        if (path === '/today') {
            return location.pathname.startsWith('/today');
        }
        if (path === '/inbox' || path === '/calendar' || path === '/everyone') {
            return location.pathname === path;
        }
        if (path.startsWith('/upcoming')) {
            return location.pathname === '/upcoming';
        }
        const isPathMatch = location.pathname === '/tasks';
        if (!isPathMatch) return false;
        const hasAssignedToMe = location.search.includes('assigned_to=me');
        // "Assigned to me" and "All Tasks" both live at /tasks; disambiguate on
        // the assigned_to marker so only one highlights.
        if (query === 'assigned_to=me') return hasAssignedToMe;
        if (query === 'status=active' && hasAssignedToMe) return false;
        const isQueryMatch = query
            ? location.search.includes(query)
            : location.search === '';
        return isQueryMatch;
    };

    const isActive = (path: string, query?: string) =>
        isActiveLink(path, query) ? activeClass : inactiveClass;

    if (compact) {
        return (
            <ul className="flex flex-col items-center gap-1">
                {navLinks.map((link) => (
                    <li key={link.path}>
                        <button
                            onClick={() =>
                                handleNavClick(link.path, link.title, link.icon)
                            }
                            title={link.title}
                            aria-label={link.title}
                            data-testid={`sidebar-rail-${link.id}`}
                            className={`relative flex items-center justify-center h-9 w-9 rounded-[8px] transition-colors duration-150 ${isActive(link.path, link.query)}`}
                        >
                            <span
                                className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${isActiveLink(link.path, link.query) ? 'text-blue-600 dark:text-[oklch(68%_0.14_250)]' : 'text-gray-500 dark:text-[oklch(65%_0.006_95)]'}`}
                            >
                                {link.icon}
                            </span>
                            {link.path === '/inbox' && inboxItemsCount > 0 && (
                                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                            )}
                        </button>
                    </li>
                ))}
                {pluginNavLinks.map((route) => (
                    <li key={route.key}>
                        <button
                            onClick={() =>
                                handleNavClick(
                                    route.path,
                                    route.nav?.label || route.id,
                                    renderPluginIcon(route)
                                )
                            }
                            title={route.nav?.label || route.id}
                            aria-label={route.nav?.label || route.id}
                            data-testid={`sidebar-rail-plugin-${route.pluginId}-${route.id}`}
                            className={`relative flex items-center justify-center h-9 w-9 rounded-[8px] transition-colors duration-150 ${isActive(route.path)}`}
                        >
                            <span
                                className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${isActiveLink(route.path) ? 'text-blue-600 dark:text-[oklch(68%_0.14_250)]' : 'text-gray-500 dark:text-[oklch(65%_0.006_95)]'}`}
                            >
                                {renderPluginIcon(route)}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <ul className="flex flex-col gap-px">
            {navLinks.map((link) => (
                <li key={link.path}>
                    <button
                        onClick={() =>
                            handleNavClick(link.path, link.title, link.icon)
                        }
                        data-testid={`sidebar-nav-${link.path.replace(/^\//, '').replace(/\?.*$/, '')}`}
                        className={`w-full flex items-center gap-[5px] px-[10px] py-[4px] rounded-[8px] transition-colors duration-150 ${isActive(link.path, link.query)}`}
                    >
                        <span
                            className={`flex-shrink-0 ${isActiveLink(link.path, link.query) ? 'text-blue-600 dark:text-[oklch(68%_0.14_250)]' : 'text-gray-400 dark:text-[oklch(55%_0.006_95)]'}`}
                        >
                            {link.icon}
                        </span>
                        <span className="flex-1 text-left text-[13.5px]">
                            {link.title}
                        </span>
                        {link.path === '/today' && planProgress && (
                            <span
                                className="text-[12px] text-gray-400 dark:text-[oklch(60%_0.01_250)]"
                                aria-label={t(
                                    'dailyPlan.sidebarProgress',
                                    '{{done}} of {{total}} planned tasks done',
                                    planProgress
                                )}
                            >
                                {planProgress.done}/{planProgress.total}
                            </span>
                        )}
                        {link.path === '/inbox' && inboxItemsCount > 0 && (
                            <span className="text-[12px] text-gray-400 dark:text-[oklch(60%_0.01_250)]">
                                {inboxItemsCount > 99 ? '99+' : inboxItemsCount}
                            </span>
                        )}
                    </button>
                </li>
            ))}
            {pluginNavLinks.map((route) => (
                <li key={route.key}>
                    <button
                        onClick={() =>
                            handleNavClick(
                                route.path,
                                route.nav?.label || route.id,
                                renderPluginIcon(route)
                            )
                        }
                        data-testid={`sidebar-nav-plugin-${route.pluginId}-${route.id}`}
                        className={`w-full flex items-center gap-[5px] px-[10px] py-[4px] rounded-[8px] transition-colors duration-150 ${isActive(route.path)}`}
                    >
                        <span
                            className={`flex-shrink-0 ${isActiveLink(route.path) ? 'text-blue-600 dark:text-[oklch(68%_0.14_250)]' : 'text-gray-400 dark:text-[oklch(55%_0.006_95)]'}`}
                        >
                            {renderPluginIcon(route)}
                        </span>
                        <span className="flex-1 text-left text-[13.5px]">
                            {route.nav?.label || route.id}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default SidebarNav;
