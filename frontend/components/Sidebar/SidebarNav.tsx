import React, { useEffect } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    ListBulletIcon,
    ClockIcon,
    CalendarIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { loadInboxItemsToStore } from '../../utils/inboxService';

interface SidebarNavProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openTaskModal: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const store = useStore();
    const calendarEnabled = useStore((state) => state.userSettingsStore.calendarEnabled);

    const inboxItemsCount = store.inboxStore.pagination.total;

    useEffect(() => {
        loadInboxItemsToStore(false).catch(console.error);
    }, []);

    const allNavLinks = [
        {
            path: '/inbox',
            title: t('sidebar.inbox', 'Inbox'),
            icon: <InboxIcon className="h-[15px] w-[15px]" />,
        },
        {
            path: '/today',
            title: t('sidebar.today', 'Today'),
            icon: <CalendarDaysIcon className="h-[15px] w-[15px]" />,
            query: 'type=today',
        },
        {
            path: '/upcoming?status=active',
            title: t('sidebar.upcoming', 'Upcoming'),
            icon: <ClockIcon className="h-[15px] w-[15px]" />,
        },
        {
            path: '/calendar',
            title: t('sidebar.calendar', 'Calendar'),
            icon: <CalendarIcon className="h-[15px] w-[15px]" />,
            userFlag: 'calendar',
        },
        {
            path: '/tasks?status=active',
            title: t('sidebar.allTasks', 'All Tasks'),
            icon: <ListBulletIcon className="h-[15px] w-[15px]" />,
            query: 'status=active',
        },
    ];

    const navLinks = allNavLinks.filter((link) => {
        if (link.userFlag === 'calendar') {
            return calendarEnabled;
        }
        return true;
    });

    const activeClass =
        'bg-blue-50 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(90%_0.01_250)] font-semibold hover:bg-blue-100 dark:hover:bg-[oklch(27%_0.02_250)]';
    const inactiveClass =
        'text-gray-700 dark:text-[oklch(75%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)]';

    const isActive = (path: string, query?: string) => {
        if (path === '/inbox' || path === '/today' || path === '/calendar') {
            return location.pathname === path ? activeClass : inactiveClass;
        }
        if (path.startsWith('/upcoming')) {
            return location.pathname === '/upcoming' ? activeClass : inactiveClass;
        }
        const isPathMatch = location.pathname === '/tasks';
        const isQueryMatch = query ? location.search.includes(query) : location.search === '';
        return isPathMatch && isQueryMatch ? activeClass : inactiveClass;
    };

    return (
        <ul className="flex flex-col gap-px">
            {navLinks.map((link) => (
                <li key={link.path}>
                    <button
                        onClick={() => handleNavClick(link.path, link.title, link.icon)}
                        data-testid={`sidebar-nav-${link.path.replace(/^\//, '').replace(/\?.*$/, '')}`}
                        className={`w-full flex items-center gap-[10px] px-[10px] py-[4px] rounded-[8px] transition-colors duration-150 ${isActive(link.path, link.query)}`}
                    >
                        <span className="flex-shrink-0 dark:text-[oklch(55%_0.006_95)]">
                            {link.icon}
                        </span>
                        <span className="flex-1 text-left text-[13.5px]">{link.title}</span>
                        {link.path === '/inbox' && inboxItemsCount > 0 && (
                            <span className="text-[12px] text-gray-400 dark:text-[oklch(60%_0.01_250)]">
                                {inboxItemsCount > 99 ? '99+' : inboxItemsCount}
                            </span>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default SidebarNav;
