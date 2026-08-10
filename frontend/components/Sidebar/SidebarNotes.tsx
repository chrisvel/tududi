import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    BookOpenIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { createNoteUrl } from '../../utils/slugUtils';

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
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const notes = useStore((state) => state.notesStore.notes);
    const hasLoaded = useStore((state) => state.notesStore.hasLoaded);
    const loadNotes = useStore((state) => state.notesStore.loadNotes);

    useEffect(() => {
        if (!hasLoaded) {
            loadNotes();
        }
    }, [hasLoaded, loadNotes]);

    const isActive = (path: string) => location.pathname.startsWith(path);

    const itemClass = (path: string) =>
        `flex items-center rounded-[8px] px-[10px] py-1 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path)
                ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
        }`;

    const getNotePath = (note: Note) => {
        try {
            return createNoteUrl(note);
        } catch {
            return '/notes';
        }
    };

    const navigate = (note: Note) =>
        handleNavClick(getNotePath(note), note.title, <BookOpenIcon className="h-4 w-4 mr-2" />);

    return (
        <div className="flex flex-col">
            <div className="flex justify-between items-center px-2.5 py-1 rounded-md">
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

            {isExpanded && (
                <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                    {notes.map((note) => (
                        <div
                            key={note.uid || note.id}
                            className={itemClass(getNotePath(note))}
                            onClick={() => navigate(note)}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                    style={{ backgroundColor: note.color || '#9ca3af' }}
                                />
                                <span className="truncate">{note.title}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SidebarNotes;
