import React, { useMemo, useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    ChevronRightIcon,
    GlobeAltIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import { createNoteUrl } from '../../utils/slugUtils';
import { useNotesTreeExpansion } from '../../hooks/useNotesTreeExpansion';
import {
    NO_PROJECT_FOLDER_KEY,
    buildNotesTree,
    collectNoteTags,
    filterNotesByQuery,
    filterNotesByTag,
    flattenVisibleRows,
    getActiveFolderKeys,
    getRecentNotes,
} from '../../utils/notesTreeUtils';

interface SidebarNotesTreeProps {
    notes: Note[];
    projects: Project[];
    location: Location;
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    searchQuery: string;
}

const BASE_PADDING_PX = 30;
const INDENT_PX = 12;
const RECENT_LIMIT = 3;
// Recent only earns its place once there are more notes than it shows.
const RECENT_MIN_NOTES = 6;
const FOLDER_LIMIT = 5;
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
    projects,
    location,
    handleNavClick,
    searchQuery,
}) => {
    const { t } = useTranslation();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [showAll, setShowAll] = useState<Record<string, boolean>>({});

    const tags = useMemo(() => collectNoteTags(notes), [notes]);
    const activeTag =
        selectedTag && tags.some((tag) => tag.name === selectedTag)
            ? selectedTag
            : null;

    const filteredNotes = useMemo(
        () =>
            filterNotesByTag(filterNotesByQuery(notes, searchQuery), activeTag),
        [notes, searchQuery, activeTag]
    );

    const tree = useMemo(
        () => buildNotesTree(filteredNotes, projects, 'updated_at:desc'),
        [filteredNotes, projects]
    );

    const activeNote = useMemo(
        () => notes.find((note) => getNotePath(note) === location.pathname),
        [notes, location.pathname]
    );

    const initialActiveKeys = useMemo(
        () => getActiveFolderKeys(activeNote),
        [activeNote]
    );

    const { expanded, toggle } = useNotesTreeExpansion(initialActiveKeys);

    const isFiltering = searchQuery.trim().length > 0 || activeTag !== null;

    const recentNotes = useMemo(
        () =>
            !isFiltering && notes.length >= RECENT_MIN_NOTES
                ? getRecentNotes(notes, RECENT_LIMIT)
                : [],
        [notes, isFiltering]
    );

    // Keep the open note visible even when it sits past a folder's limit.
    const activeFolderKey = activeNote
        ? getActiveFolderKeys(activeNote)[0] || NO_PROJECT_FOLDER_KEY
        : null;
    const folderShowAll = useMemo(
        () =>
            activeFolderKey ? { ...showAll, [activeFolderKey]: true } : showAll,
        [showAll, activeFolderKey]
    );

    const rows = flattenVisibleRows({
        tree,
        expanded,
        forceExpandAll: isFiltering,
        labels: {
            folders: '',
            // With no project folders at all, loose notes stay loose rather
            // than hiding behind a lone "No project" folder.
            noProject:
                tree.rootFolders.length > 0
                    ? t('notes.sidebar.noProject', 'No project')
                    : undefined,
        },
        folderLimit: FOLDER_LIMIT,
        showAll: folderShowAll,
    }).filter((row) => row.type !== 'section-header');

    const itemClass = (isActive: boolean) =>
        `flex justify-between items-center gap-2 rounded-[8px] py-[4px] pr-[10px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
        }`;

    const sectionLabelClass =
        'pt-2 pb-0.5 pr-[10px] text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-400 dark:text-gray-500';

    const renderNoteRow = (note: Note, key: string, indent: number) => {
        const path = getNotePath(note);
        return (
            <div
                key={key}
                onClick={() =>
                    handleNavClick(
                        path,
                        note.title,
                        <BookOpenIcon className="h-4 w-4 mr-2" />
                    )
                }
                style={{ paddingLeft: indent }}
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

    if (isFiltering && rows.length === 0) {
        return (
            <div className="flex flex-col mb-1.5">
                <span
                    style={{ paddingLeft: BASE_PADDING_PX }}
                    className="text-[13.5px] text-gray-400 dark:text-gray-500"
                >
                    {t('notes.noNotesFound', 'No notes found')}
                </span>
                {tagSection}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5 mb-1.5">
            {recentNotes.length > 0 && (
                <>
                    <div
                        style={{ paddingLeft: BASE_PADDING_PX }}
                        className={sectionLabelClass}
                    >
                        {t('notes.sidebar.recent', 'Recent')}
                    </div>
                    {recentNotes.map((note) =>
                        renderNoteRow(
                            note,
                            `recent:${note.uid}`,
                            BASE_PADDING_PX
                        )
                    )}
                    <div
                        style={{ paddingLeft: BASE_PADDING_PX }}
                        className={sectionLabelClass}
                    >
                        {t('notes.sidebar.projects', 'Projects')}
                    </div>
                </>
            )}
            {rows.map((row) => {
                if (row.type === 'more') {
                    return (
                        <button
                            key={row.key}
                            type="button"
                            onClick={() =>
                                setShowAll((prev) => ({
                                    ...prev,
                                    [row.folderKey]: true,
                                }))
                            }
                            style={{
                                paddingLeft: BASE_PADDING_PX + INDENT_PX,
                            }}
                            className="text-left rounded-[8px] py-[4px] pr-[10px] text-[12.5px] text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-[oklch(24%_0.015_250)] focus:outline-none"
                        >
                            {t('notes.sidebar.more', '{{count}} more', {
                                count: row.count,
                            })}
                        </button>
                    );
                }

                const indent = BASE_PADDING_PX + row.depth * INDENT_PX;

                if (row.type === 'folder') {
                    return (
                        <div
                            key={row.key}
                            onClick={() => toggle(row.key)}
                            style={{ paddingLeft: indent }}
                            className={itemClass(false)}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <span
                                    aria-hidden="true"
                                    className={`h-2 w-2 flex-shrink-0 rounded-[3px] ${
                                        row.color
                                            ? ''
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    style={
                                        row.color
                                            ? { backgroundColor: row.color }
                                            : undefined
                                    }
                                />
                                <span className="truncate min-w-0">
                                    {row.label}
                                </span>
                            </span>
                            <span className="flex-shrink-0 flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                {row.count}
                                <ChevronRightIcon
                                    className="h-3 w-3 transition-transform duration-150"
                                    style={{
                                        transform: row.expanded
                                            ? 'rotate(90deg)'
                                            : 'none',
                                    }}
                                />
                            </span>
                        </div>
                    );
                }

                return renderNoteRow(row.note, row.key, indent);
            })}
            {tagSection}
        </div>
    );
};

export default SidebarNotesTree;
