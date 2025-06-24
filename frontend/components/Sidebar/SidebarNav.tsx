import React from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightCircleIcon,
  InboxIcon,
  CheckCircleIcon,
  ListBulletIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';

interface SidebarNavProps {
  handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
  location: Location;
  isDarkMode: boolean;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ handleNavClick, location }) => {
  const { t } = useTranslation();
  
  const navLinks = [
    { path: '/inbox', title: t('sidebar.inbox', 'Inbox'), icon: <InboxIcon className="h-5 w-5" /> },
    { path: '/today', title: t('sidebar.today', 'Today'), icon: <CalendarDaysIcon className="h-5 w-5" />, query: 'type=today' },
    { path: '/tasks?type=upcoming', title: t('sidebar.upcoming', 'Upcoming'), icon: <ClockIcon className="h-5 w-5" />, query: 'type=upcoming' },
    { path: '/tasks', title: t('sidebar.allTasks', 'All Tasks'), icon: <ListBulletIcon className="h-5 w-5" /> },
    { path: '/calendar', title: t('sidebar.calendar', 'Calendar'), icon: <CalendarIcon className="h-5 w-5" /> },
  ];

  const isActive = (path: string, query?: string) => {
    // Handle special case for paths without query parameters
    if (path === '/inbox' || path === '/today' || path === '/calendar') {
      const isPathMatch = location.pathname === path;
      return isPathMatch
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
        : 'text-gray-700 dark:text-gray-300';
    }
    
    // Regular case for /tasks with query params
    const isPathMatch = location.pathname === '/tasks';
    const isQueryMatch = query ? location.search.includes(query) : location.search === '';
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
              onClick={() => handleNavClick(link.path, link.title, link.icon)}
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActive(
                link.path,
                link.query
              )}`}
            >
              {link.icon}
              <span className="ml-2">{link.title}</span>
            </button>
          </li>
          {link.path === '/inbox' && (
            <li className="py-1" />
          )}
        </React.Fragment>
      ))}
    </ul>
  );
};

export default SidebarNav;