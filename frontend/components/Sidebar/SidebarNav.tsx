import React, { useEffect } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    ListBulletIcon,
    ClockIcon,
} from '@heroicons/react/24/solid';
import { useStore } from '../../store/useStore';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { loadInboxItemsToStore } from '../../utils/inboxService';

interface SidebarNavProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const store = useStore();

    // Get inbox items count for badge
    const inboxItemsCount = store.inboxStore.inboxItems.length;

    // Load inbox items when component mounts to ensure badge shows correct count
    useEffect(() => {
        loadInboxItemsToStore(false).catch(console.error);
    }, []);

    const navLinks = [
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
            path: '/upcoming',
            title: t('sidebar.upcoming', 'Upcoming'),
            icon: <ClockIcon className="h-5 w-5" />,
        },
        {
            path: '/tasks',
            title: t('sidebar.allTasks', 'All Tasks'),
            icon: <ListBulletIcon className="h-5 w-5" />,
        },
    ];

    // Append admin link if current user is admin (read from global window state via current_user fetch in App)
    try {
        const raw = (window as any).__CURRENT_USER__;
        if (raw?.is_admin) {
            navLinks.push({
                path: '/admin/users',
                title: t('sidebar.adminUsers', 'User Management'),
                icon: <ShieldCheckIcon className="h-5 w-5" />,
            } as any);
        }
    } catch {}

    const isActive = (path: string, query?: string) => {
        // Handle special case for paths without query parameters
        if (path === '/inbox' || path === '/today' || path === '/upcoming') {
            const isPathMatch = location.pathname === path;
            return isPathMatch
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300';
        }

        // Regular case for /tasks with query params
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
                            className={`w-full text-left px-4 py-1 flex items-center justify-between rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActive(
                                link.path,
                                link.query
                            )}`}
                        >
                            <div className="flex items-center">
                                {link.icon}
                                <span className="ml-2">{link.title}</span>
                            </div>
                            {link.path === '/inbox' && inboxItemsCount > 0 && (
                                <span className="text-sm font-bold text-blue-500 dark:text-blue-400">
                                    {inboxItemsCount > 99
                                        ? '99+'
                                        : inboxItemsCount}
                                </span>
                            )}
                        </button>
                    </li>
                </React.Fragment>
            ))}
        </ul>
    );
};

export default SidebarNav;
