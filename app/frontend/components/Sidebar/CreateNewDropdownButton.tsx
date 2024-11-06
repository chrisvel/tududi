import React, { useState } from 'react';
import { PlusCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { Area } from '../../entities/Area';

interface CreateNewDropdownButtonProps {
  openTaskModal: () => void;
  openProjectModal: () => void;
  openNoteModal: (note: Note | null) => void;
  openAreaModal: (area: Area | null) => void;
}

const CreateNewDropdownButton: React.FC<CreateNewDropdownButtonProps> = ({
  openTaskModal,
  openProjectModal,
  openNoteModal,
  openAreaModal,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownSelect = (type: string) => {
    switch (type) {
      case 'Task':
        openTaskModal();
        break;
      case 'Project':
        openProjectModal();
        break;
      case 'Note':
        openNoteModal(null);
        break;
      case 'Area':
        openAreaModal(null);
        break;
      default:
        break;
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative mb-8">
      <button
        type="button"
        className="flex justify-between items-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-gray-400 dark:focus:ring-offset-gray-900"
        onClick={toggleDropdown}
      >
        <span className="flex items-center">
          <PlusCircleIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          Create New
        </span>
        <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      </button>

      {isDropdownOpen && (
        <div className="origin-top-left absolute left-0 mt-2 w-full rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <ul className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            {['Task', 'Project', 'Note', 'Area'].map((item) => (
              <li
                key={item}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => handleDropdownSelect(item)}
                role="menuitem"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreateNewDropdownButton;
