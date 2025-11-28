import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/solid';
import {
    PencilIcon,
    TrashIcon,
    FolderIcon,
    TagIcon as TagIconOutline,
    ClockIcon,
    EllipsisVerticalIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToast } from './Shared/ToastContext';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { SortOption } from './Shared/SortFilterButton';
import NoteModal from './Note/NoteModal';
import ConfirmDialog from './Shared/ConfirmDialog';
import DiscardChangesDialog from './Shared/DiscardChangesDialog';
import MarkdownRenderer from './Shared/MarkdownRenderer';
import IconSortDropdown from './Shared/IconSortDropdown';
import TagInput from './Tag/TagInput';
import { Note } from '../entities/Note';
import { createNote, updateNote } from '../utils/notesService';
import { deleteNoteWithStoreUpdate } from '../utils/noteDeleteUtils';
import { useStore } from '../store/useStore';
import { createProject } from '../utils/projectsService';
import { ENABLE_NOTE_COLOR } from '../config/featureFlags';

const NOTE_COLORS = [
    { name: 'None', value: '' },
    { name: 'Red', value: '#B71C1C' },
    { name: 'Orange', value: '#E65100' },
    { name: 'Amber', value: '#FF8F00' },
    { name: 'Green', value: '#2E7D32' },
    { name: 'Teal', value: '#00695C' },
    { name: 'Blue', value: '#1565C0' },
    { name: 'Indigo', value: '#283593' },
    { name: 'Purple', value: '#6A1B9A' },
    { name: 'Pink', value: '#AD1457' },
    { name: 'Grey', value: '#424242' },
];

const shouldUseLightText = (hexColor: string | undefined): boolean => {
    if (!hexColor) return false;

    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.4;
};

const Notes: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();
    const { uid } = useParams<{ uid?: string }>();
    const navigate = useNavigate();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [previewNote, setPreviewNote] = useState<Note | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [showTagsInput, setShowTagsInput] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [showNoteOptionsDropdown, setShowNoteOptionsDropdown] =
        useState(false);
    const [saveStatus, setSaveStatus] = useState<
        'saved' | 'saving' | 'unsaved'
    >('saved');
    const hasAutoSelected = useRef(false);

    const editingNoteColor =
        ENABLE_NOTE_COLOR && editingNote ? editingNote.color : undefined;
    const previewNoteColor =
        ENABLE_NOTE_COLOR && previewNote ? previewNote.color : undefined;
    const activeNoteColor =
        (isEditing && editingNoteColor) || previewNoteColor || undefined;
    const noteOptionsDropdownRef = useRef<HTMLDivElement>(null);

    const { notes, isLoading, isError, hasLoaded, loadNotes, setNotes } =
        useStore((state) => state.notesStore);
    const projects = useStore((state) => state.projectsStore.projects);

    useEffect(() => {
        if (!hasLoaded && !isLoading && !isError) {
            loadNotes();
        }
    }, [hasLoaded, isLoading, isError, loadNotes]);

    const debouncedSave = useDebouncedCallback(async (noteToSave: Note) => {
        if (!noteToSave.title) return;

        try {
            setSaveStatus('saving');

            if (noteToSave.tags && noteToSave.tags.length > 0) {
                const { tagsStore } = useStore.getState();
                tagsStore.addNewTags(noteToSave.tags.map((t) => t.name));
            }

            if (noteToSave.uid) {
                const savedNote = await updateNote(noteToSave.uid, noteToSave);
                const updatedNotes = notes.map((n) =>
                    n.uid === noteToSave.uid ? savedNote : n
                );
                setNotes(updatedNotes);
                setEditingNote(savedNote);
            } else {
                const newNote = await createNote(noteToSave);
                setNotes([newNote, ...notes]);
                setEditingNote(newNote);
                navigate(`/notes/${newNote.uid}`, { replace: true });
            }

            setSaveStatus('saved');
        } catch (err) {
            console.error('Error autosaving note:', err);
            setSaveStatus('unsaved');
        }
    }, 1000);

    const handleNoteChange = useCallback(
        (updates: Partial<Note>) => {
            if (!editingNote) return;

            const updatedNote = { ...editingNote, ...updates };
            setEditingNote(updatedNote);

            if (updatedNote.title) {
                setSaveStatus('unsaved');
                debouncedSave(updatedNote);
            }
        },
        [editingNote, debouncedSave]
    );

    const sortOptions: SortOption[] = [
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
        { value: 'title:asc', label: t('sort.name', 'Title') },
        { value: 'updated_at:desc', label: t('common.updated', 'Updated') },
    ];

    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
    };

    const handleSelectNote = async (note: Note | null) => {
        if (isEditing && editingNote) {
            if (editingNote.title) {
                try {
                    if (editingNote.tags && editingNote.tags.length > 0) {
                        const { tagsStore } = useStore.getState();
                        tagsStore.addNewTags(
                            editingNote.tags.map((t) => t.name)
                        );
                    }

                    if (editingNote.uid) {
                        const savedNote = await updateNote(
                            editingNote.uid,
                            editingNote
                        );
                        const updatedNotes = notes.map((n) =>
                            n.uid === editingNote.uid ? savedNote : n
                        );
                        setNotes(updatedNotes);
                    } else {
                        const newNote = await createNote(editingNote);
                        setNotes([newNote, ...notes]);
                    }
                } catch (err) {
                    console.error('Error saving note:', err);
                }
            }

            setIsEditing(false);
            setEditingNote(null);
            setShowProjectDropdown(false);
            setShowTagsInput(false);
        }

        setPreviewNote(note);
        if (note?.uid) {
            navigate(`/notes/${note.uid}`, { replace: true });
        } else {
            navigate('/notes', { replace: true });
        }
    };

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        try {
            await deleteNoteWithStoreUpdate(noteToDelete, showSuccessToast, t);
            setIsConfirmDialogOpen(false);
            setNoteToDelete(null);

            if (previewNote?.uid === noteToDelete.uid) {
                setPreviewNote(null);
            }

            if (editingNote?.uid === noteToDelete.uid) {
                setIsEditing(false);
                setEditingNote(null);
                setShowProjectDropdown(false);
                setShowTagsInput(false);
                setSaveStatus('saved');
            }

            navigate('/notes', { replace: true });
        } catch (err) {
            console.error('Error deleting note:', err);
        }
    };

    const handleEditNote = (note: Note) => {
        const project = note.project || note.Project;
        const tags = note.tags || note.Tags || [];

        setEditingNote({
            ...note,
            project_uid: project?.uid || note.project_uid,
            project: project,
            tags: tags,
        });
        setIsEditing(true);
        setSaveStatus('saved');
        handleSelectNote(null);
    };

    const handleNewNote = () => {
        setEditingNote({
            title: '',
            content: '',
            tags: [],
        });
        setIsEditing(true);
        setSaveStatus('saved');
        handleSelectNote(null);
    };

    const handleSaveInlineNote = async () => {
        if (!editingNote || !editingNote.title) return;

        try {
            if (editingNote.tags && editingNote.tags.length > 0) {
                const { tagsStore } = useStore.getState();
                tagsStore.addNewTags(editingNote.tags.map((t) => t.name));
            }

            if (editingNote.uid) {
                const savedNote = await updateNote(
                    editingNote.uid,
                    editingNote
                );
                const updatedNotes = notes.map((note) =>
                    note.uid === editingNote.uid ? savedNote : note
                );
                setNotes(updatedNotes);
                setIsEditing(false);
                setEditingNote(null);
                setShowProjectDropdown(false);
                setShowTagsInput(false);
                setPreviewNote(savedNote);
                navigate(`/notes/${savedNote.uid}`, { replace: true });
            } else {
                const newNote = await createNote(editingNote);
                setNotes([newNote, ...notes]);
                setIsEditing(false);
                setEditingNote(null);
                setShowProjectDropdown(false);
                setShowTagsInput(false);
                setPreviewNote(newNote);
                navigate(`/notes/${newNote.uid}`, { replace: true });
            }
        } catch (err) {
            console.error('Error saving note:', err);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditingNote(null);
        setShowProjectDropdown(false);
        setShowTagsInput(false);
        if (previewNote) {
            handleSelectNote(previewNote);
        }
    };

    const handleProjectButtonClick = (
        e: React.MouseEvent<HTMLButtonElement>
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setShowProjectDropdown((prev) => !prev);
        setShowTagsInput(false);
    };

    const handleTagsButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTagsInput((prev) => !prev);
        setShowProjectDropdown(false);
    };

    const handleColorChange = async (color: string, note: Note) => {
        if (!ENABLE_NOTE_COLOR) return;
        try {
            const updatedNote = { ...note, color };

            if (previewNote?.uid === note.uid || !note.uid) {
                setPreviewNote(updatedNote);
            }
            if (editingNote?.uid === note.uid || (isEditing && !note.uid)) {
                setEditingNote(updatedNote);
            }

            if (note.uid) {
                const savedNote = await updateNote(note.uid, updatedNote);
                const updatedNotes = notes.map((n) =>
                    n.uid === note.uid ? savedNote : n
                );
                setNotes(updatedNotes);

                if (previewNote?.uid === note.uid) {
                    setPreviewNote(savedNote);
                }
                if (editingNote?.uid === note.uid) {
                    setEditingNote(savedNote);
                }
            }
            setShowNoteOptionsDropdown(false);
        } catch (err) {
            console.error('Error updating note color:', err);
        }
    };

    const handleSaveNote = async (noteData: Note) => {
        try {
            if (noteData.uid) {
                const savedNote = await updateNote(noteData.uid, noteData);
                const updatedNotes = notes.map((note) =>
                    note.uid === noteData.uid ? savedNote : note
                );
                setNotes(updatedNotes);
            } else {
                const newNote = await createNote(noteData);
                setNotes([newNote, ...notes]);
            }
            setIsNoteModalOpen(false);
            setSelectedNote(null);
        } catch (err) {
            console.error('Error saving note:', err);
        }
    };

    const handleCreateProject = async (name: string) => {
        try {
            const newProject = await createProject({
                name,
                priority: 'low',
            });
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const filteredNotes = useMemo(() => {
        return notes.filter(
            (note) =>
                note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [notes, searchQuery]);

    const sortedNotes = useMemo(() => {
        return [...filteredNotes].sort((a, b) => {
            const [field, direction] = orderBy.split(':');
            const isAsc = direction === 'asc';

            let valueA: string | number;
            let valueB: string | number;

            switch (field) {
                case 'title':
                    valueA = a.title?.toLowerCase() || '';
                    valueB = b.title?.toLowerCase() || '';
                    break;
                case 'updated_at':
                    valueA = a.updated_at
                        ? new Date(a.updated_at).getTime()
                        : 0;
                    valueB = b.updated_at
                        ? new Date(b.updated_at).getTime()
                        : 0;
                    break;
                case 'created_at':
                default:
                    valueA = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    valueB = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;
                    break;
            }

            if (valueA < valueB) return isAsc ? -1 : 1;
            if (valueA > valueB) return isAsc ? 1 : -1;
            return 0;
        });
    }, [filteredNotes, orderBy]);

    useEffect(() => {
        if (uid && sortedNotes.length > 0 && !hasAutoSelected.current) {
            const noteFromUrl = sortedNotes.find((note) => note.uid === uid);
            if (noteFromUrl) {
                setPreviewNote(noteFromUrl);
                hasAutoSelected.current = true;
            } else if (!previewNote) {
                const isDesktop = window.innerWidth >= 768;
                if (isDesktop) {
                    handleSelectNote(sortedNotes[0]);
                    hasAutoSelected.current = true;
                }
            }
        }
    }, [uid, sortedNotes]);

    useEffect(() => {
        if (
            !uid &&
            sortedNotes.length > 0 &&
            !previewNote &&
            !hasAutoSelected.current
        ) {
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop) {
                handleSelectNote(sortedNotes[0]);
                hasAutoSelected.current = true;
            }
        }
    }, [sortedNotes, previewNote, uid]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                noteOptionsDropdownRef.current &&
                !noteOptionsDropdownRef.current.contains(event.target as Node)
            ) {
                setShowNoteOptionsDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isEditing) {
                e.preventDefault();
                if (editingNote?.title) {
                    handleSaveInlineNote();
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isEditing, editingNote]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('notes.loading')}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">{t('notes.error')}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
                <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                    <div
                        className={`${previewNote || isEditing ? 'hidden md:flex' : 'flex'} flex-col md:w-80 w-full h-full md:h-auto flex-shrink-0 min-h-0`}
                    >
                        <div className="flex items-center justify-between mb-2 mx-3 flex-shrink-0">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {t('notes.title')}
                            </h3>
                            <div className="flex items-center gap-2">
                                <IconSortDropdown
                                    options={sortOptions}
                                    value={orderBy}
                                    onChange={handleSortChange}
                                    ariaLabel={t(
                                        'notes.sortNotes',
                                        'Sort notes'
                                    )}
                                    title={t('notes.sortNotes', 'Sort notes')}
                                    dropdownLabel={t('notes.sortBy', 'Sort by')}
                                />
                                <button
                                    onClick={handleNewNote}
                                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
                                    aria-label={t('notes.addNote', 'Add Note')}
                                >
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="mb-2 mx-4 flex-shrink-0">
                            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                                <input
                                    type="text"
                                    placeholder={t('notes.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-0 overflow-y-auto flex-1 min-h-0">
                            {sortedNotes.length === 0 ? (
                                <div className="flex items-center justify-center h-full p-4">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                                        {t('notes.noNotesFound')}
                                    </p>
                                </div>
                            ) : (
                                sortedNotes.map((note, index) => (
                                    <div
                                        key={note.uid}
                                        onClick={() => handleSelectNote(note)}
                                        className={`relative p-5 cursor-pointer ${
                                            previewNote?.uid === note.uid
                                                ? 'bg-white dark:bg-gray-900 border-b border-transparent mx-4 rounded-lg'
                                                : index !==
                                                    sortedNotes.length - 1
                                                  ? 'border-b border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-gray-800 mx-4'
                                                  : 'border-b border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 mx-4'
                                        }`}
                                    >
                                        {previewNote?.uid === note.uid && (
                                            <span className="absolute inset-y-0 left-0 w-1 bg-blue-400 dark:bg-blue-500 rounded-l-md pointer-events-none" />
                                        )}
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                                            {note.title ||
                                                t(
                                                    'notes.untitled',
                                                    'Untitled Note'
                                                )}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                            {note.content.substring(0, 100)}
                                            {note.content.length > 100
                                                ? '...'
                                                : ''}
                                        </p>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                            {new Date(
                                                note.updated_at ||
                                                    note.created_at ||
                                                    ''
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div
                        className={`${previewNote || isEditing ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden h-full rounded-md md:h-auto ${activeNoteColor ? '' : 'bg-white dark:bg-gray-900'}`}
                        style={{
                            backgroundColor: activeNoteColor || undefined,
                        }}
                    >
                        {isEditing && editingNote ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex items-start justify-between mb-3 flex-shrink-0 px-6 md:px-8 pt-5">
                                    <div className="flex-1">
                                        <button
                                            onClick={() => {
                                                if (editingNote.title) {
                                                    handleSaveInlineNote();
                                                } else {
                                                    setShowDiscardDialog(true);
                                                }
                                            }}
                                            className="md:hidden mb-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                        >
                                            ← {t('common.back', 'Back to list')}
                                        </button>
                                        <input
                                            type="text"
                                            value={editingNote.title || ''}
                                            onChange={(e) =>
                                                handleNoteChange({
                                                    title: e.target.value,
                                                })
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Note title..."
                                            className="w-full bg-transparent text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-0 pt-5 mb-4 block"
                                            style={{
                                                color: editingNoteColor
                                                    ? shouldUseLightText(
                                                          editingNoteColor
                                                      )
                                                        ? '#ffffff'
                                                        : '#333333'
                                                    : undefined,
                                                fontSize: '2rem',
                                                lineHeight: '2rem',
                                                fontWeight: 500,
                                                paddingLeft: 0,
                                                paddingRight: 0,
                                            }}
                                            autoFocus
                                        />
                                        <div
                                            className="flex flex-col text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-2"
                                            style={{
                                                color: editingNoteColor
                                                    ? shouldUseLightText(
                                                          editingNoteColor
                                                      )
                                                        ? '#e0e0e0'
                                                        : '#333333'
                                                    : undefined,
                                            }}
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center">
                                                    <ClockIcon className="h-3 w-3 mr-1" />
                                                    <span>
                                                        {editingNote.updated_at
                                                            ? new Date(
                                                                  editingNote.updated_at
                                                              ).toLocaleDateString()
                                                            : 'New'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleProjectButtonClick
                                                    }
                                                    className="flex items-center hover:underline text-left"
                                                    title={
                                                        editingNote.project
                                                            ? 'Change project'
                                                            : 'Add project'
                                                    }
                                                >
                                                    <FolderIcon className="h-3 w-3 mr-1" />
                                                    {editingNote.project
                                                        ? editingNote.project
                                                              .name
                                                        : 'Add project'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleTagsButtonClick
                                                    }
                                                    className="flex items-center hover:underline text-left"
                                                    title={
                                                        editingNote.tags &&
                                                        editingNote.tags
                                                            .length > 0
                                                            ? 'Change tags'
                                                            : 'Add tags'
                                                    }
                                                >
                                                    <TagIconOutline className="h-3 w-3 mr-1" />
                                                    <span>
                                                        {editingNote.tags &&
                                                        editingNote.tags
                                                            .length > 0
                                                            ? editingNote.tags.map(
                                                                  (
                                                                      tag,
                                                                      idx
                                                                  ) => (
                                                                      <React.Fragment
                                                                          key={
                                                                              idx
                                                                          }
                                                                      >
                                                                          {idx >
                                                                              0 &&
                                                                              ', '}
                                                                          {
                                                                              tag.name
                                                                          }
                                                                      </React.Fragment>
                                                                  )
                                                              )
                                                            : 'Add tags'}
                                                    </span>
                                                </button>
                                            </div>
                                            {editingNote.title && (
                                                <div className="flex items-center">
                                                    {saveStatus ===
                                                        'saving' && (
                                                        <span className="text-blue-500 dark:text-blue-400 italic">
                                                            Saving...
                                                        </span>
                                                    )}
                                                    {saveStatus === 'saved' && (
                                                        <span className="text-green-600 dark:text-green-400">
                                                            ✓ Saved
                                                        </span>
                                                    )}
                                                    {saveStatus ===
                                                        'unsaved' && (
                                                        <span className="text-amber-600 dark:text-amber-400">
                                                            • Unsaved changes
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className="relative"
                                        ref={noteOptionsDropdownRef}
                                    >
                                        <button
                                            onClick={() =>
                                                setShowNoteOptionsDropdown(
                                                    !showNoteOptionsDropdown
                                                )
                                            }
                                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            style={{
                                                color: editingNoteColor
                                                    ? shouldUseLightText(
                                                          editingNoteColor
                                                      )
                                                        ? '#e0e0e0'
                                                        : '#333333'
                                                    : undefined,
                                            }}
                                            aria-label="Note options"
                                        >
                                            <EllipsisVerticalIcon className="h-5 w-5" />
                                        </button>
                                        {showNoteOptionsDropdown && (
                                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                {ENABLE_NOTE_COLOR && (
                                                    <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                                            Background Color
                                                        </div>
                                                        <div className="grid grid-cols-5 gap-2">
                                                            {NOTE_COLORS.map(
                                                                (
                                                                    colorOption
                                                                ) => (
                                                                    <button
                                                                        key={
                                                                            colorOption.value
                                                                        }
                                                                        onClick={() =>
                                                                            handleColorChange(
                                                                                colorOption.value,
                                                                                editingNote
                                                                            )
                                                                        }
                                                                        className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                                                            editingNote.color ===
                                                                            colorOption.value
                                                                                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                                                                                : 'border-gray-300 dark:border-gray-600'
                                                                        }`}
                                                                        style={{
                                                                            backgroundColor:
                                                                                colorOption.value ||
                                                                                '#ffffff',
                                                                        }}
                                                                        title={
                                                                            colorOption.name
                                                                        }
                                                                        aria-label={`Set background to ${colorOption.name}`}
                                                                    >
                                                                        {!colorOption.value && (
                                                                            <XMarkIcon className="h-5 w-5 text-gray-400" />
                                                                        )}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            if (
                                                                editingNote.title
                                                            ) {
                                                                handleSaveInlineNote();
                                                            } else {
                                                                setShowDiscardDialog(
                                                                    true
                                                                );
                                                            }
                                                            setShowNoteOptionsDropdown(
                                                                false
                                                            );
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        {t(
                                                            'notes.save',
                                                            'Save'
                                                        )}
                                                    </button>
                                                    {editingNote.uid && (
                                                        <button
                                                            onClick={() => {
                                                                setNoteToDelete(
                                                                    editingNote
                                                                );
                                                                setIsConfirmDialogOpen(
                                                                    true
                                                                );
                                                                setShowNoteOptionsDropdown(
                                                                    false
                                                                );
                                                            }}
                                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                            {t(
                                                                'notes.delete',
                                                                'Delete'
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {showProjectDropdown && (
                                    <div className="mb-3 mx-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Select Project
                                        </label>
                                        <select
                                            value={
                                                editingNote.project_uid || ''
                                            }
                                            onChange={(e) => {
                                                const projectUid =
                                                    e.target.value || null;
                                                const selectedProject =
                                                    projectUid
                                                        ? projects.find(
                                                              (p) =>
                                                                  p.uid ===
                                                                  projectUid
                                                          )
                                                        : undefined;
                                                handleNoteChange({
                                                    project_uid: projectUid,
                                                    project:
                                                        selectedProject as any,
                                                });
                                                setShowProjectDropdown(false);
                                            }}
                                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        >
                                            <option value="">No Project</option>
                                            {projects.map((project) => (
                                                <option
                                                    key={project.uid}
                                                    value={project.uid}
                                                >
                                                    {project.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {showTagsInput && (
                                    <div className="mb-3 mx-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Tags
                                        </label>
                                        <TagInput
                                            initialTags={(
                                                editingNote.tags ||
                                                editingNote.Tags ||
                                                []
                                            ).map((t: any) => t.name)}
                                            onTagsChange={(
                                                tagNames: string[]
                                            ) => {
                                                handleNoteChange({
                                                    tags: tagNames.map(
                                                        (name: string) => ({
                                                            name,
                                                        })
                                                    ),
                                                });
                                            }}
                                            availableTags={useStore
                                                .getState()
                                                .tagsStore.getTags()}
                                        />
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto px-6 md:px-8">
                                    <textarea
                                        value={editingNote.content || ''}
                                        onChange={(e) =>
                                            handleNoteChange({
                                                content: e.target.value,
                                            })
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Write your note content here... (Markdown supported)"
                                        className="w-full h-full min-h-[300px] bg-transparent text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-0 resize-none py-4"
                                        style={{
                                            color: editingNoteColor
                                                ? shouldUseLightText(
                                                      editingNoteColor
                                                  )
                                                    ? '#ffffff'
                                                    : '#333333'
                                                : undefined,
                                        }}
                                    />
                                </div>
                            </div>
                        ) : previewNote ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex items-start justify-between mb-3 flex-shrink-0 px-6 md:px-8 pt-5">
                                    <div className="flex-1">
                                        <button
                                            onClick={() =>
                                                handleSelectNote(null)
                                            }
                                            className="md:hidden mb-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                        >
                                            ← {t('common.back', 'Back to list')}
                                        </button>
                                        <h1
                                            onClick={() =>
                                                handleEditNote(previewNote)
                                            }
                                            className="cursor-pointer text-gray-900 dark:text-gray-100 transition-colors pt-5 mb-4"
                                            style={{
                                                color: previewNoteColor
                                                    ? shouldUseLightText(
                                                          previewNoteColor
                                                      )
                                                        ? '#ffffff'
                                                        : '#333333'
                                                    : undefined,
                                                fontSize: '2rem',
                                                lineHeight: '2rem',
                                                fontWeight: 500,
                                            }}
                                            title="Click to edit"
                                        >
                                            {previewNote.title ||
                                                t(
                                                    'notes.untitled',
                                                    'Untitled Note'
                                                )}
                                        </h1>
                                        <div
                                            className="flex flex-col md:flex-row md:flex-wrap md:items-center text-xs text-gray-500 dark:text-gray-400 space-y-1 md:space-y-0 md:gap-3 mb-2"
                                            style={{
                                                color: previewNoteColor
                                                    ? shouldUseLightText(
                                                          previewNoteColor
                                                      )
                                                        ? '#e0e0e0'
                                                        : '#333333'
                                                    : undefined,
                                            }}
                                        >
                                            <div className="flex items-center">
                                                <ClockIcon className="h-3 w-3 mr-1" />
                                                <span>
                                                    {new Date(
                                                        previewNote.updated_at ||
                                                            previewNote.created_at ||
                                                            ''
                                                    ).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {(previewNote.project ||
                                                previewNote.Project) && (
                                                <div className="flex items-center">
                                                    <FolderIcon className="h-3 w-3 mr-1" />
                                                    <Link
                                                        to={
                                                            (
                                                                previewNote.project ||
                                                                previewNote.Project
                                                            )?.uid
                                                                ? `/project/${(previewNote.project || previewNote.Project).uid}-${(
                                                                      previewNote.project ||
                                                                      previewNote.Project
                                                                  )?.name
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                                : `/project/${(previewNote.project || previewNote.Project)?.id}`
                                                        }
                                                        className="hover:underline"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        {
                                                            (
                                                                previewNote.project ||
                                                                previewNote.Project
                                                            )?.name
                                                        }
                                                    </Link>
                                                </div>
                                            )}
                                            {((previewNote.tags &&
                                                previewNote.tags.length > 0) ||
                                                (previewNote.Tags &&
                                                    previewNote.Tags.length >
                                                        0)) && (
                                                <div className="flex items-center">
                                                    <TagIconOutline className="h-3 w-3 mr-1" />
                                                    <span>
                                                        {(
                                                            previewNote.tags ||
                                                            previewNote.Tags ||
                                                            []
                                                        ).map((tag, idx) => (
                                                            <React.Fragment
                                                                key={tag.name}
                                                            >
                                                                {idx > 0 &&
                                                                    ', '}
                                                                <Link
                                                                    to={
                                                                        tag.uid
                                                                            ? `/tag/${tag.uid}-${tag.name
                                                                                  .toLowerCase()
                                                                                  .replace(
                                                                                      /[^a-z0-9]+/g,
                                                                                      '-'
                                                                                  )
                                                                                  .replace(
                                                                                      /^-|-$/g,
                                                                                      ''
                                                                                  )}`
                                                                            : `/tag/${tag.name
                                                                                  .toLowerCase()
                                                                                  .replace(
                                                                                      /[^a-z0-9]+/g,
                                                                                      '-'
                                                                                  )
                                                                                  .replace(
                                                                                      /^-|-$/g,
                                                                                      ''
                                                                                  )}`
                                                                    }
                                                                    className="hover:underline"
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    {tag.name}
                                                                </Link>
                                                            </React.Fragment>
                                                        ))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className="relative"
                                        ref={noteOptionsDropdownRef}
                                    >
                                        <button
                                            onClick={() =>
                                                setShowNoteOptionsDropdown(
                                                    !showNoteOptionsDropdown
                                                )
                                            }
                                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            style={{
                                                color: previewNoteColor
                                                    ? shouldUseLightText(
                                                          previewNoteColor
                                                      )
                                                        ? '#e0e0e0'
                                                        : '#333333'
                                                    : undefined,
                                            }}
                                            aria-label="Note options"
                                        >
                                            <EllipsisVerticalIcon className="h-5 w-5" />
                                        </button>
                                        {showNoteOptionsDropdown && (
                                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                {ENABLE_NOTE_COLOR && (
                                                    <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                                            Background Color
                                                        </div>
                                                        <div className="grid grid-cols-5 gap-2">
                                                            {NOTE_COLORS.map(
                                                                (
                                                                    colorOption
                                                                ) => (
                                                                    <button
                                                                        key={
                                                                            colorOption.value
                                                                        }
                                                                        onClick={() =>
                                                                            handleColorChange(
                                                                                colorOption.value,
                                                                                previewNote
                                                                            )
                                                                        }
                                                                        className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                                                            previewNote.color ===
                                                                            colorOption.value
                                                                                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                                                                                : 'border-gray-300 dark:border-gray-600'
                                                                        }`}
                                                                        style={{
                                                                            backgroundColor:
                                                                                colorOption.value ||
                                                                                '#ffffff',
                                                                        }}
                                                                        title={
                                                                            colorOption.name
                                                                        }
                                                                        aria-label={`Set background to ${colorOption.name}`}
                                                                    >
                                                                        {!colorOption.value && (
                                                                            <XMarkIcon className="h-5 w-5 text-gray-400" />
                                                                        )}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            handleEditNote(
                                                                previewNote
                                                            );
                                                            setShowNoteOptionsDropdown(
                                                                false
                                                            );
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        {t(
                                                            'notes.edit',
                                                            'Edit'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setNoteToDelete(
                                                                previewNote
                                                            );
                                                            setIsConfirmDialogOpen(
                                                                true
                                                            );
                                                            setShowNoteOptionsDropdown(
                                                                false
                                                            );
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        {t(
                                                            'notes.delete',
                                                            'Delete'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div
                                    onClick={() => handleEditNote(previewNote)}
                                    className="text-sm md:text-base flex-1 overflow-y-auto cursor-pointer px-6 md:px-8 py-4 text-gray-900 dark:text-gray-100"
                                    style={{
                                        color: previewNoteColor
                                            ? shouldUseLightText(
                                                  previewNoteColor
                                              )
                                                ? '#ffffff'
                                                : '#333333'
                                            : undefined,
                                    }}
                                    title="Click to edit"
                                >
                                    <MarkdownRenderer
                                        content={previewNote.content}
                                        noteColor={previewNoteColor}
                                        onContentChange={async (newContent) => {
                                            const updatedNote = {
                                                ...previewNote,
                                                content: newContent,
                                            };
                                            setPreviewNote(updatedNote);

                                            if (previewNote.uid) {
                                                try {
                                                    const savedNote =
                                                        await updateNote(
                                                            previewNote.uid,
                                                            updatedNote
                                                        );
                                                    const updatedNotes =
                                                        notes.map((n) =>
                                                            n.uid ===
                                                            previewNote.uid
                                                                ? savedNote
                                                                : n
                                                        );
                                                    setNotes(updatedNotes);
                                                    setPreviewNote(savedNote);
                                                } catch (err) {
                                                    console.error(
                                                        'Error updating note:',
                                                        err
                                                    );
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
                                {t(
                                    'notes.selectNote',
                                    'Select a note to preview'
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isNoteModalOpen && (
                    <NoteModal
                        isOpen={isNoteModalOpen}
                        onClose={() => {
                            setIsNoteModalOpen(false);
                        }}
                        onSave={handleSaveNote}
                        onDelete={async (noteUid) => {
                            try {
                                await deleteNoteWithStoreUpdate(
                                    noteUid,
                                    showSuccessToast,
                                    t
                                );
                                setIsNoteModalOpen(false);
                                setSelectedNote(null);
                            } catch (err) {
                                console.error('Error deleting note:', err);
                            }
                        }}
                        note={selectedNote}
                        projects={
                            projects?.length > 0
                                ? projects
                                : ([
                                      {
                                          id: 1,
                                          name: 'Test Project 1',
                                          active: true,
                                          priority: 'low',
                                      },
                                      {
                                          id: 2,
                                          name: 'tududi',
                                          active: true,
                                          priority: 'high',
                                      },
                                  ] as any)
                        }
                        onCreateProject={handleCreateProject}
                    />
                )}

                {isConfirmDialogOpen && noteToDelete && (
                    <ConfirmDialog
                        title={t('modals.deleteNote.title')}
                        message={t('modals.deleteNote.message', {
                            noteTitle: noteToDelete.title,
                        })}
                        onConfirm={handleDeleteNote}
                        onCancel={() => setIsConfirmDialogOpen(false)}
                    />
                )}

                {showDiscardDialog && (
                    <DiscardChangesDialog
                        onDiscard={() => {
                            setShowDiscardDialog(false);
                            handleCancelEdit();
                        }}
                        onCancel={() => setShowDiscardDialog(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default Notes;
