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
              <li className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <Link
                  to="/profile"
                  className="block w-full px-4 py-2 text-left"
                >
                  Profile
                </Link>
              </li>
              <li className="border-t border-gray-200 dark:border-gray-700"></li>
              <li className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <a
                  href="/logout"
                  className="block w-full px-4 py-2 text-left text-red-500"
                >
                  Sign out
                </a>
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
