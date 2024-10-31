import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

interface SidebarFooterProps {
  currentUser: { email: string };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDropdownOpen: boolean;
  toggleDropdown: () => void;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({
  isDarkMode,
  toggleDarkMode,
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  return (
    <div className="mt-auto p-3">
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className={`flex items-center justify-center`}>
          {/* Dark Mode Toggle */}
          {isSidebarOpen && (
            <button
              onClick={toggleDarkMode}
              className="focus:outline-none text-gray-700 dark:text-gray-300"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6 text-yellow-500" />
              ) : (
                <MoonIcon className="h-6 w-6 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarFooter;
