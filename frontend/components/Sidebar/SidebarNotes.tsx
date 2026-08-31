import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    BookOpenIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
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
    const [searchQuery, setSearchQuery] = useState('');

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
            <div
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-md hover:bg-gray-100 dark:hover:bg-white/5 ${
                    location.pathname.startsWith('/notes')
                        ? 'bg-gray-100 dark:bg-white/5'
                        : ''
                }`}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname.startsWith('/notes')
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() => {
                        setIsExpanded(true);
                        handleNavClick('/notes', t('sidebar.notes'), <BookOpenIcon className="h-4 w-4 mr-2" />);
                    }}
                >
                    <BookOpenIcon className="h-[14px] w-[14px]" />
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
                        <>
                            <span className="text-[10.5px] text-gray-400 dark:text-gray-500 tabular-nums">
                                {notes.length}
                            </span>
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
                        </>
                    )}
                </div>
            </div>

            {isExpanded && (
                <>
                    {notes.length > 0 && (
                        <div className="flex items-center gap-[6px] ml-[30px] mr-[10px] mt-1 mb-1 px-[8px] py-[3px] rounded-md bg-gray-100 dark:bg-white/5">
                            <MagnifyingGlassIcon className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('notes.searchPlaceholder', 'Search notes...')}
                                className="w-full min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-[12px] text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                    )}
                    <SidebarNotesTree
                        notes={notes}
                        projects={projects}
                        location={location}
                        handleNavClick={handleNavClick}
                        searchQuery={searchQuery}
                    />
                </>
            )}
        </div>
    );
};

export default SidebarNotes;
