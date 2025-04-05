import React from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightCircleIcon,
  InboxIcon,
  ClockIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  ListBulletIcon,
} from '@heroicons/react/24/solid';

interface SidebarNavProps {
  handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
  location: Location;
  isDarkMode: boolean;
}


const SidebarNav: React.FC<SidebarNavProps> = ({ handleNavClick, location }) => {
  const { t } = useTranslation();
  
  const navLinks = [
    { path: '/today', title: t('sidebar.today', 'Today'), icon: <CalendarDaysIcon className="h-5 w-5" />, query: 'type=today' },
    { path: '/tasks?type=upcoming', title: t('sidebar.upcoming', 'Upcoming'), icon: <CalendarIcon className="h-5 w-5" />, query: 'type=upcoming' },
    { path: '/tasks?type=next', title: t('sidebar.nextActions', 'Next Actions'), icon: <ArrowRightCircleIcon className="h-5 w-5" />, query: 'type=next' },
    { path: '/tasks?type=inbox', title: t('sidebar.inbox', 'Inbox'), icon: <InboxIcon className="h-5 w-5" />, query: 'type=inbox' },
    // { path: '/tasks?type=someday', title: t('sidebar.someday', 'Someday'), icon: <ClockIcon className="h-5 w-5" />, query: 'type=someday' },
    // { path: '/tasks?type=waiting', title: t('sidebar.waitingFor', 'Waiting for'), icon: <PauseCircleIcon className="h-5 w-5" />, query: 'type=waiting' },
    { path: '/tasks?status=done', title: t('sidebar.completed', 'Completed'), icon: <CheckCircleIcon className="h-5 w-5" />, query: 'status=done' },
    { path: '/tasks', title: t('sidebar.allTasks', 'All Tasks'), icon: <ListBulletIcon className="h-5 w-5" /> },
  ];
  const isActive = (path: string, query?: string) => {
    const isPathMatch = location.pathname === '/tasks';
    const isQueryMatch = query ? location.search.includes(query) : location.search === '';
    return isPathMatch && isQueryMatch
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <ul className="flex flex-col space-y-1">
      {navLinks.map((link) => (
        <li key={link.path}>
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
      ))}
    </ul>
  );
};

export default SidebarNav;
