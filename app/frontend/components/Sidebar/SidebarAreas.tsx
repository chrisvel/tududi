// src/components/Sidebar/SidebarAreas.tsx

import React from 'react';
import { Squares2X2Icon, PlusCircleIcon } from '@heroicons/react/24/solid'; // Using solid style
import { Area } from '../../entities/Area'; // Adjust the import path

interface SidebarAreasProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
  openAreaModal: () => void; // Modify to not require an area parameter for creation
}

const SidebarAreas: React.FC<SidebarAreasProps> = ({
  handleNavClick,
  location,
  isDarkMode,
  openAreaModal,
}) => {
  const isActiveArea = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "AREAS" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 rounded-md uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveArea(
            '/areas'
          )}`}
          onClick={() => handleNavClick('/areas', 'Areas', 'squares2x2')}
        >
          <span className="flex items-center">
            <Squares2X2Icon className="h-5 w-5 mr-2" />
            AREAS
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick
              openAreaModal(); // Open modal for creating a new area
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Area"
            title="Add Area"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>
      </ul>
    </>
  );
};

export default SidebarAreas;
