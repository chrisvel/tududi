import React, { useMemo, useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    GlobeAltIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { createNoteUrl } from '../../utils/slugUtils';
import {
    collectNoteTags,
    filterNotesByTag,
    getRecentNotes,
} from '../../utils/notesTreeUtils';

interface SidebarNotesTreeProps {
    notes: Note[];
    location: Location;
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
}

const BASE_PADDING_PX = 30;
const RECENT_LIMIT = 3;
// The notes table is the place for the full list.
const TAG_NOTES_LIMIT = 10;
const TAG_LIMIT = 12;

const getNotePath = (note: Note) => {
    try {
        return createNoteUrl(note);
    } catch {
        return '/notes';
    }
};

const SidebarNotesTree: React.FC<SidebarNotesTreeProps> = ({
    notes,
    location,
    handleNavClick,
}) => {
    const { t } = useTranslation();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    const tags = useMemo(() => collectNoteTags(notes), [notes]);
    const activeTag =
        selectedTag && tags.some((tag) => tag.name === selectedTag)
            ? selectedTag
            : null;

    const listedNotes = useMemo(
        () =>
            activeTag
                ? getRecentNotes(
                      filterNotesByTag(notes, activeTag),
                      TAG_NOTES_LIMIT
                  )
                : getRecentNotes(notes, RECENT_LIMIT),
        [notes, activeTag]
    );

    const itemClass = (isActive: boolean) =>
        `flex justify-between items-center gap-2 rounded-[8px] py-[4px] pr-[10px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
        }`;

    const sectionLabelClass =
        'pt-2 pb-0.5 pr-[10px] text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-400 dark:text-gray-500';

    const renderNoteRow = (note: Note) => {
        const path = getNotePath(note);
        return (
            <div
                key={note.uid}
                onClick={() =>
                    handleNavClick(
                        path,
                        note.title,
                        <BookOpenIcon className="h-4 w-4 mr-2" />
                    )
                }
                style={{ paddingLeft: BASE_PADDING_PX }}
                className={itemClass(location.pathname === path)}
            >
                <span className="truncate min-w-0">
                    {note.title || t('notes.untitled', 'Untitled Note')}
                </span>
                {note.is_public && (
                    <GlobeAltIcon
                        className="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400"
                        title={t(
                            'notes.publicShare.sharedTitle',
                            'Shared with anyone who has the link'
                        )}
                        aria-label={t(
                            'notes.publicShare.sharedTitle',
                            'Shared with anyone who has the link'
                        )}
                        data-testid={`note-shared-indicator-${note.uid}`}
                    />
                )}
            </div>
        );
    };

    const tagSection =
        tags.length > 0 ? (
            <div data-testid="notes-sidebar-tags">
                <div
                    style={{ paddingLeft: BASE_PADDING_PX }}
                    className={sectionLabelClass}
                >
                    {t('notes.sidebar.tags', 'Tags')}
                </div>
                <div
                    style={{ paddingLeft: BASE_PADDING_PX }}
                    className="flex flex-wrap gap-1 pr-[10px] pt-1 pb-1"
                >
                    {tags.slice(0, TAG_LIMIT).map((tag) => {
                        const isSelected = activeTag === tag.name;
                        return (
                            <button
                                key={tag.name}
                                type="button"
                                onClick={() =>
                                    setSelectedTag(isSelected ? null : tag.name)
                                }
                                aria-pressed={isSelected}
                                className={`flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    isSelected
                                        ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
                                }`}
                            >
                                #{tag.name}
                                {isSelected && (
                                    <XMarkIcon
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        ) : null;

    return (
        <div className="flex flex-col gap-0.5 mb-1.5">
            {!activeTag && listedNotes.length > 0 && (
                <div
                    style={{ paddingLeft: BASE_PADDING_PX }}
                    className={sectionLabelClass}
                >
                    {t('notes.sidebar.recent', 'Recent')}
                </div>
            )}
            {listedNotes.map(renderNoteRow)}
            {tagSection}
        </div>
    );
};

export default SidebarNotesTree;
