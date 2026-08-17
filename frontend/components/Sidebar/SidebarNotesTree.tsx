import React, { useMemo } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import { createNoteUrl } from '../../utils/slugUtils';
import { useNotesTreeExpansion } from '../../hooks/useNotesTreeExpansion';
import {
    buildNotesTree,
    flattenVisibleRows,
    getActiveFolderKeys,
} from '../../utils/notesTreeUtils';

interface SidebarNotesTreeProps {
    notes: Note[];
    projects: Project[];
    location: Location;
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
}

const BASE_PADDING_PX = 10;
const INDENT_PX = 12;

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
}) => {
    const { t } = useTranslation();

    const tree = useMemo(
        () => buildNotesTree(notes, projects, 'updated_at:desc'),
        [notes, projects]
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

    // The "NOTES" header directly above already labels this section, so the
    // tree's own "Folders" section-header row would just be redundant noise
    // in this small peek box.
    const rows = flattenVisibleRows({
        tree,
        expanded,
        forceExpandAll: false,
        labels: { folders: '' },
    }).filter((row) => row.type !== 'section-header');

    const itemClass = (isActive: boolean) =>
        `flex justify-between items-center gap-2 rounded-[8px] py-1 pr-[10px] text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive
                ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
        }`;

    return (
        <div className="flex flex-col gap-0.5 mb-1.5">
            {rows.map((row) => {
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
                                    className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                    style={{
                                        backgroundColor:
                                            row.color || '#9ca3af',
                                    }}
                                />
                                <span className="truncate">{row.label}</span>
                            </span>
                            <span className="flex-shrink-0 flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                <span className="text-[9px]">
                                    {row.expanded ? '▾' : '▸'}
                                </span>
                                {row.count}
                            </span>
                        </div>
                    );
                }

                const path = getNotePath(row.note);
                return (
                    <div
                        key={row.key}
                        onClick={() =>
                            handleNavClick(
                                path,
                                row.note.title,
                                <BookOpenIcon className="h-4 w-4 mr-2" />
                            )
                        }
                        style={{ paddingLeft: indent }}
                        className={itemClass(location.pathname === path)}
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <span
                                className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                style={{
                                    backgroundColor:
                                        row.note.color || '#9ca3af',
                                }}
                            />
                            <span className="truncate">
                                {row.note.title ||
                                    t('notes.untitled', 'Untitled Note')}
                            </span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default SidebarNotesTree;
