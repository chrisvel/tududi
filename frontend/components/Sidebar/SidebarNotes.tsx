import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    BookOpenIcon,
    ChevronRightIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import SidebarNotesTree from './SidebarNotesTree';

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
    const [isExpanded, setIsExpanded] = useState(false);

    const notes = useStore((state) => state.notesStore.notes);
    const hasLoaded = useStore((state) => state.notesStore.hasLoaded);
    const loadNotes = useStore((state) => state.notesStore.loadNotes);

    const projects = useStore((state) => state.projectsStore.projects);
    const projectsHasLoaded = useStore(
        (state) => state.projectsStore.hasLoaded
    );
    const loadProjects = useStore((state) => state.projectsStore.loadProjects);

    useEffect(() => {
        if (!hasLoaded) {
            loadNotes();
        }
    }, [hasLoaded, loadNotes]);

    useEffect(() => {
        if (!projectsHasLoaded) {
            loadProjects();
        }
    }, [projectsHasLoaded, loadProjects]);

    return (
        <div className="flex flex-col">
            <div className="group flex justify-between items-center px-2.5 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/5">
                <span
                    className={`flex items-center gap-1.5 text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname.startsWith('/notes')
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() =>
                        handleNavClick('/notes', t('sidebar.notes'), <BookOpenIcon className="h-4 w-4 mr-2" />)
                    }
                >
                    <BookOpenIcon className="h-3.5 w-3.5" />
                    {t('sidebar.notes')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openNoteModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('notes.addNote', 'Add Note')}
                        title={t('notes.addNote', 'Add Note')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {notes.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        >
                            <ChevronRightIcon
                                className="h-3 w-3 transition-transform duration-150"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <SidebarNotesTree
                    notes={notes}
                    projects={projects}
                    location={location}
                    handleNavClick={handleNavClick}
                />
            )}
        </div>
    );
};

export default SidebarNotes;
