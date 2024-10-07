import React from 'react';
import { Link } from 'react-router-dom';

interface SidebarFooterProps {
  currentUser: { email: string };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isDropdownOpen: boolean;
  toggleDropdown: () => void;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({
  currentUser,
  isDarkMode,
  toggleDarkMode,
  isDropdownOpen,
  toggleDropdown,
}) => {
  return (
    <div className="mt-auto">
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="relative">
          <button
            className="flex justify-center items-center text-gray-700 dark:text-gray-300 w-full focus:outline-none"
            onClick={toggleDropdown}
          >
            <strong>{currentUser.email}</strong>
            <i className={`ml-2 bi ${isDropdownOpen ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`}></i>
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg shadow-lg z-50">
              <li className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <Link to="/profile">Profile</Link> {/* Link to Profile */}
              </li>
              <li className="border-t border-gray-200 dark:border-gray-700"></li>
              <li className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-red-500">
                <a href="/logout" className="w-full text-left block">Sign out</a>
              </li>
            </ul>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          id="darkModeToggle"
          className="mt-3 w-full flex items-center justify-center text-gray-700 dark:text-gray-300"
          onClick={toggleDarkMode}
        >
          <i className={`bi ${isDarkMode ? 'bi-sun' : 'bi-moon'} text-lg`}></i>
        </button>
      </div>
    </div>
  );
};

export default SidebarFooter;
