import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import {
    CheckIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    MagnifyingGlassIcon,
    ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import { FolderIcon, TagIcon } from '@heroicons/react/24/solid';
import { Note } from '../../entities/Note';
import { useStore } from '../../store/useStore';
import { formatShortDate } from '../../utils/dateUtils';
import { noteMatchesFocus, useFocus } from '../../utils/focus';
import {
    NO_PROJECT_FILTER,
    collectNoteProjects,
    collectNoteTags,
    filterNotesByProjects,
    filterNotesByTags,
    getNotePreview,
    searchNotes,
    sortNotesByOrder,
} from '../../utils/notesTreeUtils';
import NewItemButton from '../Shared/NewItemButton';
import { MultiPickerDropdown } from '../Task/TaskPanelDropdowns';
import {
    HIDEABLE_COLUMNS,
    NOTE_COLUMN_WIDTHS,
    NoteColumnId,
    useNotesTableColumns,
} from './useNotesTableColumns';

const PAGE_SIZE = 100;
const MAX_ROW_TAGS = 2;
const RESIZE_KEY_STEP = 10;
const PHONE_QUERY = '(max-width: 639px)';
const PHONE_COLUMNS: NoteColumnId[] = ['title', 'updated_at'];

const COLUMN_LABELS: Record<NoteColumnId, [string, string]> = {
    title: ['notes.overview.columnTitle', 'Title'],
    preview: ['notes.overview.columnPreview', 'Preview'],
    project: ['notes.overview.columnProject', 'Project'],
    tags: ['notes.overview.columnTags', 'Tags'],
    updated_at: ['notes.overview.columnUpdated', 'Updated'],
    created_at: ['notes.overview.columnCreated', 'Created'],
};

const formatDate = (value?: string) =>
    value ? formatShortDate(new Date(value)) : '';

const useIsPhone = () => {
    const [isPhone, setIsPhone] = useState(
        () => !!window.matchMedia?.(PHONE_QUERY)?.matches
    );
    useEffect(() => {
        const query = window.matchMedia?.(PHONE_QUERY);
        if (!query) return;
        const onChange = () => setIsPhone(query.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);
    return isPhone;
};

interface NotesOverviewProps {
    onNewNote: () => void;
}

// The table of every note, and what /notes shows. Search and filters live in
// the URL so Back from a note lands on the same view; sort and columns are
// remembered per browser.
const NotesOverview: React.FC<NotesOverviewProps> = ({ onNewNote }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const focus = useFocus();
    const isPhone = useIsPhone();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        order,
        widths,
        sort,
        setSort,
        moveColumn,
        resizeColumn,
        resetColumnWidth,
        hidden,
        toggleColumn,
    } = useNotesTableColumns();

    const notes = useStore((state) => state.notesStore.notes);
    const projects = useStore((state) => state.projectsStore.projects);

    const [sortField, sortDirection] = sort.split(':');
    const query = searchParams.get('q') || '';
    const tagParams = searchParams.getAll('tag');
    const projectParams = searchParams.getAll('project');

    const [searchText, setSearchText] = useState(query);
    // Open when the address already carries a search, like Back from a note.
    const [isSearchExpanded, setIsSearchExpanded] = useState(!!query);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [draggedColumn, setDraggedColumn] = useState<NoteColumnId | null>(
        null
    );
    const [dropTarget, setDropTarget] = useState<NoteColumnId | null>(null);
    const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
    const columnsMenuRef = useRef<HTMLDivElement>(null);

    const setParam = (key: string, value: string | null) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
            next.set(key, value);
        } else {
            next.delete(key);
        }
        setSearchParams(next, { replace: true });
    };

    const setListParam = (key: string, values: string[]) => {
        const next = new URLSearchParams(searchParams);
        next.delete(key);
        values.forEach((value) => next.append(key, value));
        setSearchParams(next, { replace: true });
    };

    const debouncedSetQuery = useDebouncedCallback(
        (value: string) => setParam('q', value.trim() || null),
        250
    );

    const scopedNotes = useMemo(
        () =>
            focus
                ? notes.filter((note) =>
                      noteMatchesFocus(note, focus, projects)
                  )
                : notes,
        [notes, focus, projects]
    );
    const tagOptions = useMemo(
        () => collectNoteTags(scopedNotes),
        [scopedNotes]
    );
    const projectOptions = useMemo(
        () => collectNoteProjects(scopedNotes),
        [scopedNotes]
    );

    // A tag or project from an old link that no longer applies filters nothing.
    const activeTags = useMemo(
        () =>
            tagParams.filter((name) =>
                tagOptions.some((tag) => tag.name === name)
            ),
        [tagParams.join('\n'), tagOptions]
    );
    const activeProjects = useMemo(
        () =>
            projectParams.filter(
                (uid) =>
                    uid === NO_PROJECT_FILTER ||
                    projectOptions.some((project) => project.uid === uid)
            ),
        [projectParams.join('\n'), projectOptions]
    );

    const rows = useMemo(
        () =>
            sortNotesByOrder(
                filterNotesByProjects(
                    filterNotesByTags(
                        searchNotes(scopedNotes, query),
                        activeTags
                    ),
                    activeProjects
                ),
                sort
            ),
        [scopedNotes, query, activeTags, activeProjects, sort]
    );

    useEffect(() => {
        if (isSearchExpanded) searchInputRef.current?.focus();
    }, [isSearchExpanded]);

    useEffect(() => {
        if (!isColumnsMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!columnsMenuRef.current?.contains(event.target as Node)) {
                setIsColumnsMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsColumnsMenuOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isColumnsMenuOpen]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [query, activeTags, activeProjects, sort]);

    const columns = isPhone
        ? order.filter((id) => PHONE_COLUMNS.includes(id))
        : order.filter((id) => !hidden.includes(id));

    // One column takes the spare width so the table fills the page and
    // dragging an edge moves it exactly with the pointer: Preview until the
    // user sizes or hides it, then an empty column on the end.
    const flexColumn: NoteColumnId | null = isPhone
        ? 'title'
        : widths.preview || !columns.includes('preview')
          ? null
          : 'preview';
    // Widths set on a wider screen don't carry over to a phone.
    const minTableWidth = isPhone
        ? 0
        : columns.reduce(
              (sum, id) => sum + (widths[id] ?? NOTE_COLUMN_WIDTHS[id]),
              0
          );

    const toggleSort = (field: string) => {
        const direction =
            sortField === field
                ? sortDirection === 'asc'
                    ? 'desc'
                    : 'asc'
                : ['title', 'project', 'tags'].includes(field)
                  ? 'asc'
                  : 'desc';
        setSort(`${field}:${direction}`);
    };

    const startResize = (id: NoteColumnId, event: React.PointerEvent) => {
        event.preventDefault();
        const handle = event.currentTarget as HTMLElement;
        const startX = event.clientX;
        const startWidth = handle.closest('th')!.getBoundingClientRect().width;
        const onMove = (move: PointerEvent) =>
            resizeColumn(id, startWidth + move.clientX - startX);
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const onHandleKeyDown = (id: NoteColumnId, event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.altKey) {
            // Past the columns that show, not the hidden ones.
            const target = columns[columns.indexOf(id) + step];
            if (target) moveColumn(id, target);
            return;
        }
        const th = (event.currentTarget as HTMLElement).closest('th')!;
        resizeColumn(
            id,
            th.getBoundingClientRect().width + step * RESIZE_KEY_STEP
        );
    };

    const renderHeader = (id: NoteColumnId) => {
        const [key, fallback] = COLUMN_LABELS[id];
        const label = t(key, fallback);
        const isSorted = sortField === id;
        const SortIcon =
            sortDirection === 'asc' ? ChevronUpIcon : ChevronDownIcon;
        return (
            <th
                key={id}
                scope="col"
                draggable={!isPhone}
                data-testid={`notes-column-${id}`}
                aria-sort={
                    id === 'preview'
                        ? undefined
                        : isSorted
                          ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                          : 'none'
                }
                onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', id);
                    setDraggedColumn(id);
                }}
                onDragOver={(event) => {
                    if (!draggedColumn) return;
                    event.preventDefault();
                    setDropTarget(id);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (draggedColumn && draggedColumn !== id) {
                        moveColumn(draggedColumn, id);
                    }
                    setDraggedColumn(null);
                    setDropTarget(null);
                }}
                onDragEnd={() => {
                    setDraggedColumn(null);
                    setDropTarget(null);
                }}
                className={`relative select-none truncate px-3 py-2.5 font-semibold ${
                    isPhone ? '' : 'cursor-grab'
                } ${draggedColumn === id ? 'opacity-50' : ''} ${
                    dropTarget === id && draggedColumn !== id
                        ? 'bg-gray-200 dark:bg-gray-700/60'
                        : 'bg-gray-100 dark:bg-gray-800/60'
                }`}
            >
                {id === 'preview' ? (
                    label
                ) : (
                    <button
                        type="button"
                        onClick={() => toggleSort(id)}
                        className={`inline-flex max-w-full items-center gap-1 uppercase tracking-wide hover:text-black dark:hover:text-white ${
                            isSorted ? 'text-gray-900 dark:text-gray-100' : ''
                        }`}
                    >
                        <span className="truncate">{label}</span>
                        {isSorted && (
                            <SortIcon className="h-3 w-3 flex-shrink-0" />
                        )}
                    </button>
                )}
                {!isPhone && (
                    <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={t('notes.overview.resizeColumn', {
                            column: label,
                            defaultValue:
                                'Resize the {{column}} column. Alt and an arrow key moves it.',
                        })}
                        tabIndex={0}
                        draggable={false}
                        onDragStart={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onPointerDown={(event) => startResize(id, event)}
                        onDoubleClick={() => resetColumnWidth(id)}
                        onKeyDown={(event) => onHandleKeyDown(id, event)}
                        data-testid={`notes-resize-${id}`}
                        className="absolute inset-y-1 right-0 w-2 cursor-col-resize rounded hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:hover:bg-white/15 dark:focus:bg-white/15"
                    />
                )}
            </th>
        );
    };

    const renderCell = (id: NoteColumnId, note: Note) => {
        const muted = 'text-gray-500 dark:text-gray-400';
        switch (id) {
            case 'title':
                return (
                    <td
                        key={id}
                        className="truncate px-3 py-2 font-medium text-gray-900 dark:text-gray-100"
                    >
                        <Link to={`/notes/${note.uid}`} title={note.title}>
                            {note.title || t('notes.untitled', 'Untitled Note')}
                        </Link>
                    </td>
                );
            case 'preview':
                return (
                    <td key={id} className={`truncate px-3 py-2 ${muted}`}>
                        {getNotePreview(note.content)}
                    </td>
                );
            case 'project':
                return (
                    <td
                        key={id}
                        className="truncate px-3 py-2 text-gray-600 dark:text-gray-300"
                    >
                        {(note.project || note.Project)?.name}
                    </td>
                );
            case 'tags': {
                const tags = note.tags || note.Tags || [];
                return (
                    <td key={id} className="truncate px-3 py-2">
                        {tags.slice(0, MAX_ROW_TAGS).map((tag) => (
                            <span
                                key={tag.name}
                                className="mr-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                            >
                                {tag.name}
                            </span>
                        ))}
                        {tags.length > MAX_ROW_TAGS && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{tags.length - MAX_ROW_TAGS}
                            </span>
                        )}
                    </td>
                );
            }
            case 'updated_at':
            case 'created_at':
                return (
                    <td key={id} className={`truncate px-3 py-2 ${muted}`}>
                        {formatDate(note[id])}
                    </td>
                );
        }
    };

    const openNote = (note: Note, event: React.MouseEvent) => {
        // The title is a real link, so it keeps open-in-new-tab.
        if ((event.target as HTMLElement).closest('a')) return;
        navigate(`/notes/${note.uid}`);
    };

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-7xl">
                    <div className="mb-8 flex items-center justify-between gap-3">
                        <h2 className="text-2xl font-light">
                            {t('notes.title', 'Notes')}
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setIsSearchExpanded(!isSearchExpanded)
                                }
                                className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-1.5 sm:p-2 ${
                                    isSearchExpanded
                                        ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                                aria-expanded={isSearchExpanded}
                                aria-label={t('common.search', 'Search')}
                                title={t('common.search', 'Search')}
                                data-testid="notes-search-toggle"
                            >
                                <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-200" />
                            </button>
                            <NewItemButton
                                label={t('notes.new', 'New Note')}
                                onClick={onNewNote}
                                testId="new-note-button"
                            />
                        </div>
                    </div>

                    <div className="mb-6 flex items-center gap-3 sm:justify-end">
                        {!isPhone && (
                            <div className="relative" ref={columnsMenuRef}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsColumnsMenuOpen(!isColumnsMenuOpen)
                                    }
                                    aria-haspopup="menu"
                                    aria-expanded={isColumnsMenuOpen}
                                    data-testid="notes-columns-button"
                                    className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-900/70"
                                >
                                    <ViewColumnsIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    {t('notes.overview.columns', 'Columns')}
                                </button>
                                {isColumnsMenuOpen && (
                                    <div
                                        role="menu"
                                        className="absolute left-0 z-30 mt-1 w-48 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                                    >
                                        {HIDEABLE_COLUMNS.map((id) => {
                                            const [key, fallback] =
                                                COLUMN_LABELS[id];
                                            const shown = !hidden.includes(id);
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    role="menuitemcheckbox"
                                                    aria-checked={shown}
                                                    onClick={() =>
                                                        toggleColumn(id)
                                                    }
                                                    data-testid={`notes-columns-toggle-${id}`}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
                                                >
                                                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                                        {shown && (
                                                            <CheckIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                                                        )}
                                                    </span>
                                                    {t(key, fallback)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                            <MultiPickerDropdown
                                values={activeTags}
                                onChange={(next) => setListParam('tag', next)}
                                options={tagOptions.map((tag) => ({
                                    value: tag.name,
                                    label: tag.name,
                                }))}
                                emptyLabel={t(
                                    'notes.overview.allTags',
                                    'All tags'
                                )}
                                ariaLabel={t(
                                    'notes.overview.columnTags',
                                    'Tags'
                                )}
                                searchPlaceholder={t(
                                    'tags.searchPlaceholder',
                                    'Search tags...'
                                )}
                                Icon={TagIcon}
                                tone="page"
                                searchable
                                testId="notes-tag-filter"
                                searchTestId="notes-tag-filter-search"
                            />
                        </div>
                        <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                            <MultiPickerDropdown
                                values={activeProjects}
                                onChange={(next) =>
                                    setListParam('project', next)
                                }
                                options={[
                                    {
                                        value: NO_PROJECT_FILTER,
                                        label: t(
                                            'notes.overview.noProject',
                                            'No project'
                                        ),
                                    },
                                    ...projectOptions.map((project) => ({
                                        value: project.uid,
                                        label: project.name,
                                    })),
                                ]}
                                mutedValues={[NO_PROJECT_FILTER]}
                                emptyLabel={t(
                                    'notes.overview.allProjects',
                                    'All projects'
                                )}
                                ariaLabel={t(
                                    'notes.overview.columnProject',
                                    'Project'
                                )}
                                searchPlaceholder={t(
                                    'projects.searchPlaceholder',
                                    'Search projects...'
                                )}
                                Icon={FolderIcon}
                                tone="page"
                                searchable
                                testId="notes-project-filter"
                                searchTestId="notes-project-filter-search"
                            />
                        </div>
                    </div>

                    <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${
                            isSearchExpanded
                                ? 'max-h-20 opacity-100 mb-4'
                                : 'max-h-0 opacity-0 mb-0'
                        }`}
                    >
                        <div className="flex items-center rounded-md bg-white p-2 shadow-sm dark:bg-gray-900">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchText}
                                onChange={(event) => {
                                    setSearchText(event.target.value);
                                    debouncedSetQuery(event.target.value);
                                }}
                                placeholder={t(
                                    'notes.overview.search',
                                    'Search titles and content...'
                                )}
                                className="w-full border-none bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {t('notes.noNotesFound', 'No notes found')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg bg-gray-50 p-1.5 shadow-sm dark:bg-gray-900">
                            <table
                                className="table-fixed text-sm"
                                style={{
                                    width: `max(100%, ${minTableWidth}px)`,
                                }}
                            >
                                <colgroup>
                                    {columns.map((id) => (
                                        <col
                                            key={id}
                                            style={
                                                id === flexColumn
                                                    ? undefined
                                                    : {
                                                          width:
                                                              (!isPhone &&
                                                                  widths[id]) ||
                                                              NOTE_COLUMN_WIDTHS[
                                                                  id
                                                              ],
                                                      }
                                            }
                                        />
                                    ))}
                                    {!flexColumn && <col />}
                                </colgroup>
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 [&>th:first-child]:rounded-l-md [&>th:last-child]:rounded-r-md">
                                        {columns.map(renderHeader)}
                                        {!flexColumn && (
                                            <th
                                                aria-hidden
                                                className="bg-gray-100 dark:bg-gray-800/60"
                                            />
                                        )}
                                    </tr>
                                    {/* A gap between the header and the first row, like Projects. */}
                                    <tr aria-hidden className="h-1" />
                                </thead>
                                <tbody>
                                    {rows.slice(0, visibleCount).map((note) => (
                                        <tr
                                            key={note.uid}
                                            onClick={(event) =>
                                                openNote(note, event)
                                            }
                                            className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/60 [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md"
                                        >
                                            {columns.map((id) =>
                                                renderCell(id, note)
                                            )}
                                            {!flexColumn && <td />}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {rows.length > visibleCount && (
                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() =>
                                    setVisibleCount(
                                        (count) => count + PAGE_SIZE
                                    )
                                }
                                className="rounded-lg bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {t('notes.overview.showMore', 'Show more')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotesOverview;
