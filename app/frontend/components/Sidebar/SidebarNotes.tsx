// src/components/Sidebar/SidebarNotes.tsx

import React from 'react';
import { Location } from 'react-router-dom';
import { BookOpenIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { Note } from '../../entities/Note'; // Import the centralized Note type

interface SidebarNotesProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
  openNoteModal: (note: Note | null) => void;
  notes: Note[];
}

const SidebarNotes: React.FC<SidebarNotesProps> = ({
  handleNavClick,
  location,
  isDarkMode,
  openNoteModal,
  notes,
}) => {
  const isActiveNote = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "NOTES" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveNote(
            '/notes'
          )}`}
          onClick={() => handleNavClick('/notes', 'Notes', 'book')}
        >
          <span className="flex items-center">
            <BookOpenIcon className="h-5 w-5 mr-2" />
            NOTES
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openNoteModal(null); // Open the modal for a new note
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Note"
            title="Add Note"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>
      </ul>
    </>
  );
};

export default SidebarNotes;
