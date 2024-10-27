import React from 'react';
import { Location } from 'react-router-dom';
import { TagIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Tag } from '../../entities/Tag';

interface SidebarTagsProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
  openTagModal: (tag: Tag | null) => void;
  tags: Tag[];
}

const SidebarTags: React.FC<SidebarTagsProps> = ({
  handleNavClick,
  location,
  isDarkMode,
  openTagModal,
  tags,
}) => {
  const isActiveTag = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "TAGS" Title with Add Button */}
        <li
          className={`flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveTag(
            '/tags'
          )}`}
          onClick={() => handleNavClick('/tags', 'Tags', 'tag')}
        >
          <span className="flex items-center">
            <TagIcon className="h-5 w-5 mr-2" />
            TAGS
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation(); 
              openTagModal(null); 
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Tag"
            title="Add Tag"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>
      </ul>
    </>
  );
};

export default SidebarTags;
