import React from 'react';
import { Location } from 'react-router-dom';
import { BookOpenIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { useTranslation } from 'react-i18next';

interface SidebarNotesProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openNoteModal: (note: Note | null) => void;
    notes: Note[];
}

const SidebarNotes: React.FC<SidebarNotesProps> = ({
    handleNavClick,
    location,
    openNoteModal,
}) => {
    const { t } = useTranslation();
    const isActiveNote = (path: string) => {
        return location.pathname.startsWith(path)
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1">
                <li
                    className={`flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveNote(
                        '/notes'
                    )}`}
                    onClick={() =>
                        handleNavClick(
                            '/notes',
                            'Notes',
                            <BookOpenIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    <span className="flex items-center">
                        <BookOpenIcon className="h-5 w-5 mr-2" />
                        {t('sidebar.notes')}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openNoteModal(null);
                        }}
                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label="Add Note"
                        title="Add Note"
                        data-testid="add-note-button"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
            </ul>
        </>
    );
};

export default SidebarNotes;
