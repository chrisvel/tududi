import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    ListBulletIcon,
    ClockIcon,
    CalendarIcon,
} from '@heroicons/react/24/solid';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { loadInboxItemsToStore } from '../../utils/inboxService';
import { getFeatureFlags, FeatureFlags } from '../../utils/featureFlags';

interface SidebarNavProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openTaskModal: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    handleNavClick,
    location,
    openTaskModal,
}) => {
    const { t } = useTranslation();
    const store = useStore();
    const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
        backups: false,
        calendar: false,
        habits: false,
    });

    const inboxItemsCount = store.inboxStore.pagination.total;

    useEffect(() => {
        loadInboxItemsToStore(false).catch(console.error);

        const fetchFlags = async () => {
            const flags = await getFeatureFlags();
            setFeatureFlags(flags);
        };
        fetchFlags();
    }, []);

    const allNavLinks = [
        {
            path: '/inbox',
            title: t('sidebar.inbox', 'Inbox'),
            icon: <InboxIcon className="h-5 w-5" />,
        },
        {
            path: '/today',
            title: t('sidebar.today', 'Today'),
            icon: <CalendarDaysIcon className="h-5 w-5" />,
            query: 'type=today',
        },
        {
            path: '/upcoming?status=active',
            title: t('sidebar.upcoming', 'Upcoming'),
            icon: <ClockIcon className="h-5 w-5" />,
        },
        {
            path: '/calendar',
            title: t('sidebar.calendar', 'Calendar'),
            icon: <CalendarIcon className="h-5 w-5" />,
            featureFlag: 'calendar',
        },
        {
            path: '/tasks?status=active',
            title: t('sidebar.allTasks', 'All Tasks'),
            icon: <ListBulletIcon className="h-5 w-5" />,
            query: 'status=active',
        },
    ];

    const navLinks = allNavLinks.filter((link) => {
        if (link.featureFlag) {
            return featureFlags[link.featureFlag as keyof FeatureFlags];
        }
        return true;
    });

    const isActive = (path: string, query?: string) => {
        if (path === '/inbox' || path === '/today' || path === '/calendar') {
            const isPathMatch = location.pathname === path;
            return isPathMatch
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300';
        }

        if (path.startsWith('/upcoming')) {
            const isPathMatch = location.pathname === '/upcoming';
            return isPathMatch
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300';
        }

        const isPathMatch = location.pathname === '/tasks';
        const isQueryMatch = query
            ? location.search.includes(query)
            : location.search === '';
        return isPathMatch && isQueryMatch
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <ul className="flex flex-col space-y-1">
            {navLinks.map((link) => (
                <React.Fragment key={link.path}>
                    <li>
                        <button
                            onClick={() =>
                                handleNavClick(link.path, link.title, link.icon)
                            }
                            data-testid={`sidebar-nav-${link.path.replace(/^\//, '').replace(/\?.*$/, '')}`}
                            className={`w-full text-left px-4 py-1 flex items-center justify-between rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActive(
                                link.path,
                                link.query
                            )}`}
                        >
                            <div className="flex items-center">
                                {link.icon}
                                <span className="ml-2">{link.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {link.path === '/inbox' &&
                                    inboxItemsCount > 0 && (
                                        <span className="text-sm font-bold text-blue-500 dark:text-blue-400">
                                            {inboxItemsCount > 99
                                                ? '99+'
                                                : inboxItemsCount}
                                        </span>
                                    )}
                                {link.path === '/tasks?status=active' && (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openTaskModal();
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === 'Enter' ||
                                                e.key === ' '
                                            ) {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                openTaskModal();
                                            }
                                        }}
                                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none cursor-pointer"
                                        aria-label={t(
                                            'sidebar.addTaskAriaLabel',
                                            'Add Task'
                                        )}
                                        title={t(
                                            'sidebar.addTaskTitle',
                                            'Add Task'
                                        )}
                                    >
                                        <PlusCircleIcon className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                        </button>
                    </li>
                </React.Fragment>
            ))}
        </ul>
    );
};

export default SidebarNav;
