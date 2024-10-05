// SidebarFooter.tsx
import React from 'react';

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
      <div className="border-t border-gray-700 pt-3">
        <div className="relative">
          <button
            className="flex justify-center items-center text-white w-full focus:outline-none"
            onClick={toggleDropdown}
          >
            <strong>{currentUser.email}</strong>
            <i
              className={`ml-2 bi ${
                isDropdownOpen ? 'bi-caret-up-fill' : 'bi-caret-down-fill'
              }`}
            ></i>
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <ul className="absolute bottom-full mb-2 w-full bg-gray-800 text-white rounded-lg shadow-lg z-50">
              <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-gray-300">
                Profile
              </li>
              <li className="border-t border-gray-700"></li>
              <li className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-red-500">
                <a href="/logout" className="w-full text-left block">
                  Sign out
                </a>
              </li>
            </ul>
          )}
        </div>

        <button
          id="darkModeToggle"
          className="btn btn-link text-white mt-3 flex items-center justify-center"
          onClick={toggleDarkMode}
        >
          <i id="darkModeIcon" className={`bi ${isDarkMode ? 'bi-sun' : 'bi-moon'}`}></i>
          <span className="ml-2">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarFooter;
