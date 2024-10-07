import React from 'react';
import { Location } from 'react-router-dom';

interface SidebarNavProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
}

const navLinks = [
  { path: '/tasks?type=today', title: 'Today', icon: 'bi-calendar-day-fill', query: 'type=today' },
  { path: '/tasks?type=inbox', title: 'Inbox', icon: 'bi-inbox-fill', query: 'type=inbox' },
  { path: '/tasks?type=next', title: 'Next Actions', icon: 'bi-arrow-right-circle-fill', query: 'type=next' },
  { path: '/tasks?type=upcoming', title: 'Upcoming', icon: 'bi-calendar3', query: 'type=upcoming' },
  { path: '/tasks?type=someday', title: 'Someday', icon: 'bi-moon-stars-fill', query: 'type=someday' },
  { path: '/tasks?status=done', title: 'Completed', icon: 'bi-check-circle', query: 'status=done' },
  { path: '/tasks', title: 'All Tasks', icon: 'bi-layers' },
];

const SidebarNav: React.FC<SidebarNavProps> = ({ handleNavClick, location, isDarkMode }) => {
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
            <i className={`bi ${link.icon} mr-2`}></i> {link.title}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default SidebarNav;
