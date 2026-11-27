import React, { useEffect } from 'react';
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
import { useSidebarSectionExpanded } from '../../hooks/useSidebarSectionExpanded';

interface SidebarNotesProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    onCreateNote: () => void;
    notes: Note[];
}

const SidebarNotes: React.FC<SidebarNotesProps> = ({
    handleNavClick,
    location,
    onCreateNote,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useSidebarSectionExpanded('notes');

    const notes = useStore((state) => state.notesStore.notes);
    const hasLoaded = useStore((state) => state.notesStore.hasLoaded);
    const loadNotes = useStore((state) => state.notesStore.loadNotes);

    const projectsHasLoaded = useStore(
        (state) => state.projectsStore.hasLoaded
    );
    const loadProjects = useStore((state) => state.projectsStore.loadProjects);

    useEffect(() => {
        if (!hasLoaded) {
            loadNotes();
        }
    }, [hasLoaded, loadNotes]);

    // The Notes page and Focus read projects from the store.
    useEffect(() => {
        if (!projectsHasLoaded) {
            loadProjects();
        }
    }, [projectsHasLoaded, loadProjects]);

    return (
        <div className="flex flex-col">
            <div
                className={`group flex justify-between items-center px-[10px] py-[4px] max-md:min-h-[44px] rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 ${
                    location.pathname.startsWith('/notes')
                        ? 'bg-gray-100 dark:bg-white/5'
                        : ''
                }`}
                onClick={() => {
                    if (notes.length > 0) setIsExpanded((v) => !v);
                }}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] max-md:text-[13px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname.startsWith('/notes')
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNavClick(
                            '/notes',
                            t('sidebar.notes'),
                            <BookOpenIcon className="h-4 w-4 mr-2" />
                        );
                    }}
                >
                    <BookOpenIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.notes')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateNote();
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('notes.addNote', 'Add Note')}
                        title={t('notes.addNote', 'Add Note')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {notes.length > 0 && (
                        <>
                            <span className="text-[10.5px] max-md:text-[13px] text-gray-400 dark:text-gray-500 tabular-nums">
                                {notes.length}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded((v) => !v);
                                }}
                                aria-expanded={isExpanded}
                                className="p-2 -m-2 text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                            >
                                <ChevronRightIcon
                                    className="h-3 w-3 transition-transform duration-150"
                                    style={{
                                        transform: isExpanded
                                            ? 'rotate(90deg)'
                                            : 'none',
                                    }}
                                />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isExpanded && notes.length > 0 && (
                <div className="mt-1 mb-1.5 rounded-xl bg-gray-50 py-1 dark:bg-white/[0.03]">
                    <SidebarNotesTree
                        notes={notes}
                        location={location}
                        handleNavClick={handleNavClick}
                    />
                </div>
            )}
        </div>
    );
};

export default SidebarNotes;
