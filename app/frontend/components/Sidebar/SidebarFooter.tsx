// src/components/Sidebar/SidebarFooter.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import {
  SunIcon,
  MoonIcon,
  ArrowLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

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
  currentUser,
  isDarkMode,
  toggleDarkMode,
  isSidebarOpen,
  setIsSidebarOpen,
  isDropdownOpen,
  toggleDropdown,
}) => {
  if (!isSidebarOpen) {
    return null; 
  }

  return (
    <div className="mt-auto p-3">
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        {/* Footer Buttons */}
        <div className="flex items-center justify-between">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center focus:outline-none text-gray-700 dark:text-gray-300"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? (
              <SunIcon className="h-6 w-6 text-yellow-500" />
            ) : (
              <MoonIcon className="h-6 w-6 text-gray-500" />
            )}
          </button>

          {/* Collapse Sidebar Button */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center focus:outline-none text-gray-700 dark:text-gray-300"
            aria-label="Collapse Sidebar"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarFooter;
