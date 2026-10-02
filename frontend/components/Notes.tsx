import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
    useLayoutEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import {
    PencilIcon,
    TrashIcon,
    FolderIcon,
    TagIcon as TagIconOutline,
    ClockIcon,
    EllipsisVerticalIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    GlobeAltIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import PushPinIcon from './Shared/Icons/PushPinIcon';
import { useToast } from './Shared/ToastContext';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import NoteModal from './Note/NoteModal';
import PublicShareModal from './Note/PublicShareModal';
import ConfirmDialog from './Shared/ConfirmDialog';
import DiscardChangesDialog from './Shared/DiscardChangesDialog';
import TagInput from './Tag/TagInput';
import { Note } from '../entities/Note';
import {
    createNote,
    updateNote,
    fetchNoteBySlug,
} from '../utils/notesService';
import { deleteNoteWithStoreUpdate } from '../utils/noteDeleteUtils';
import { useStore } from '../store/useStore';
import { createProject } from '../utils/projectsService';
import { sortNotesByOrder } from '../utils/notesTreeUtils';
import { COLORS } from './Shared/ColorPicker';
import NoteBackgroundPicker from './Note/NoteBackgroundPicker';
import PhotoCredit from './Shared/PhotoCredit';
import {
    contentBackgroundUrl,
    findContentBackground,
} from '../constants/contentBackgrounds';
import NoteFocusMode from './Note/NoteFocusMode';
import MarkdownEditor from './Note/MarkdownEditor';
import NoteCard from './Shared/NoteCard';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';
import { FORM } from '../constants/formClasses';


const shouldUseLightText = (hexColor: string | undefined): boolean => {
    if (!hexColor) return false;

    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.4;
};

// The editor is always live, so the user may have kept typing while a save
// was in flight. Only take the server's identity and timestamps, never its
// copy of title/content, and ignore a save for a note we have left.
const mergeSavedNote = (current: Note | null, saved: Note): Note | null => {
    if (!current) return current;
    if (current.uid && current.uid !== saved.uid) return current;
    return {
        ...current,
        id: saved.id,
        uid: saved.uid,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
    };
};

const Notes: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();
    const { uid } = useParams<{ uid?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [previewNote, setPreviewNote] = useState<Note | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [noteToShare, setNoteToShare] = useState<Note | null>(null);
    // Notes are browsed via the sidebar's folder tree now, not a list on
    // this page - this page is the editor/preview pane only. `orderBy`
    // still picks which note auto-selects first on load.
    const orderBy = 'updated_at:desc';
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [showTagsInput, setShowTagsInput] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [showNoteOptionsDropdown, setShowNoteOptionsDropdown] =
        useState(false);
    const [saveStatus, setSaveStatus] = useState<
        'saved' | 'saving' | 'unsaved'
    >('saved');
    const [isFocusMode, setIsFocusMode] = useState(false);
    const hasAutoSelected = useRef(false);
    // Timestamp flag attached to the /notes navigation state by Layout's
    // "new note" action; deduplicated per location entry below.
    const newNoteSignal = (location.state as { newNote?: number } | null)
        ?.newNote;
    const newNoteSignalRef = useRef<number | null>(null);

    const editingNoteColor = editingNote ? editingNote.color : undefined;
    const previewNoteColor = previewNote ? previewNote.color : undefined;
    const activeNoteColor =
        (isEditing && editingNoteColor) || previewNoteColor || undefined;
    // Let the content background show through the open note a little.
    const activeNoteBackground =
        activeNoteColor && /^#[0-9a-f]{6}$/i.test(activeNoteColor)
            ? `${activeNoteColor}d9`
            : activeNoteColor;
    // A note's photo shows through a lighter tint of its color (or the page
    // color), so the text stays readable.
    const activeNotePhoto = findContentBackground(
        (isEditing ? editingNote?.background : previewNote?.background) ??
            null
    );
    const activeNoteStyle: React.CSSProperties = activeNotePhoto
        ? ({
              backgroundImage: `linear-gradient(var(--note-tint), var(--note-tint)), url(${contentBackgroundUrl(activeNotePhoto, 1600)})`,
              ...(activeNoteColor && /^#[0-9a-f]{6}$/i.test(activeNoteColor)
                  ? { '--note-tint': `${activeNoteColor}bf` }
                  : {}),
          } as React.CSSProperties)
        : { backgroundColor: activeNoteBackground || undefined };
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
                setEditingNote((current) =>
                    mergeSavedNote(current, savedNote)
                );
            } else {
                const newNote = await createNote(noteToSave);
                setNotes([newNote, ...notes]);
                setEditingNote((current) => mergeSavedNote(current, newNote));
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

    const leaveEditing = useCallback(() => {
        debouncedSave.flush();
        setIsEditing(false);
        setEditingNote(null);
        setShowProjectDropdown(false);
        setShowTagsInput(false);
    }, [debouncedSave]);

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
    };

    // Notes always open in the live editor: selecting one (sidebar, URL,
    // auto-select) puts it straight into edit mode, and switching to another
    // note flushes the pending save of the one being left first.
    useLayoutEffect(() => {
        if (!previewNote) return;
        if (
            isEditing &&
            editingNote?.uid &&
            previewNote.uid &&
            editingNote.uid !== previewNote.uid
        ) {
            leaveEditing();
            return;
        }
        if (!isEditing) {
            handleEditNote(previewNote);
        }
    }, [previewNote, isEditing, editingNote?.uid, leaveEditing]);

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

    const handleColorChange = (color: string, note: Note) =>
        handleLookChange({ color }, note);

    const handleBackgroundChange = (background: string | null, note: Note) =>
        handleLookChange({ background }, note);

    const handleLookChange = async (
        changes: Pick<Note, 'color' | 'background'>,
        note: Note
    ) => {
        try {
            const updatedNote = { ...note, ...changes };

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
            console.error('Error updating note look:', err);
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

    const handleTogglePin = async (note: Note) => {
        if (!note.uid) return;
        const newValue = !note.pin_to_sidebar;
        const updated = { ...note, pin_to_sidebar: newValue };

        if (previewNote?.uid === note.uid) setPreviewNote(updated);
        if (editingNote?.uid === note.uid) setEditingNote(updated);
        setNotes(notes.map((n) => (n.uid === note.uid ? { ...n, pin_to_sidebar: newValue } : n)));

        try {
            await updateNote(note.uid, { pin_to_sidebar: newValue } as any);
        } catch (err) {
            console.error('Error toggling pin:', err);
            if (previewNote?.uid === note.uid) setPreviewNote(note);
            if (editingNote?.uid === note.uid) setEditingNote(note);
            setNotes(notes.map((n) => (n.uid === note.uid ? { ...n, pin_to_sidebar: !newValue } : n)));
        }
    };

    const sortedNotes = useMemo(
        () => sortNotesByOrder(notes, orderBy),
        [notes, orderBy]
    );

    const startNewNote = useCallback(() => {
        // Fresh blank note opened straight in the inline editor; nothing is
        // persisted until the user types a title and saves.
        setPreviewNote(null);
        setEditingNote({ title: '', content: '' });
        setIsEditing(true);
        setSaveStatus('saved');
        setShowProjectDropdown(false);
        setShowTagsInput(false);
        setIsFocusMode(false);
    }, []);

    // Open a blank editor when navigated here with the "new note" flag
    // (sidebar + button, footer create menu, keyboard shortcut). The ref
    // deduplicates React 18 StrictMode's double effect invocation.
    useEffect(() => {
        if (
            newNoteSignal &&
            newNoteSignalRef.current !== newNoteSignal
        ) {
            newNoteSignalRef.current = newNoteSignal;
            startNewNote();
            navigate('/notes', { replace: true, state: {} });
        }
    }, [newNoteSignal, startNewNote, navigate]);

    useEffect(() => {
        hasAutoSelected.current = false;
    }, [uid]);

    useEffect(() => {
        if (newNoteSignal) return;
        if (!uid || !hasLoaded || hasAutoSelected.current) return;

        const noteFromUrl = sortedNotes.find((note) => note.uid === uid);
        if (noteFromUrl) {
            setPreviewNote(noteFromUrl);
            hasAutoSelected.current = true;
            return;
        }

        // Not in the cached notes list. This can legitimately happen when a
        // project was shared with us after the list was last loaded (#1523):
        // the note exists and we have access, it's just missing from the
        // stale cache. Fetch it directly before assuming it doesn't exist -
        // otherwise we'd silently fall back to whatever note happens to be
        // first in the list.
        hasAutoSelected.current = true;
        fetchNoteBySlug(uid)
            .then((fetchedNote) => {
                if (!fetchedNote) throw new Error('Note not found');
                setNotes([fetchedNote, ...notes]);
                setPreviewNote(fetchedNote);
            })
            .catch(() => {
                if (!previewNote) {
                    const isDesktop = window.innerWidth >= 768;
                    if (isDesktop) {
                        handleSelectNote(sortedNotes[0]);
                    }
                }
            });
    }, [uid, sortedNotes, hasLoaded]);

    useEffect(() => {
        if (newNoteSignal) return;
        if (
            !uid &&
            sortedNotes.length > 0 &&
            !previewNote &&
            !isEditing &&
            !hasAutoSelected.current
        ) {
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop) {
                handleSelectNote(sortedNotes[0]);
                hasAutoSelected.current = true;
            }
        }
    }, [sortedNotes, previewNote, uid, isEditing]);

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
                debouncedSave.flush();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isEditing, debouncedSave]);

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

    const notesHeader = (
        <div className="flex items-center justify-between gap-2 mb-6">
            <h2 className="text-2xl font-light">{t('notes.title', 'Notes')}</h2>
            <NewItemButton
                label={t('notes.new', 'New Note')}
                onClick={startNewNote}
                testId="new-note-button"
            />
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        className={`relative flex flex-1 flex-col overflow-hidden h-full rounded-md backdrop-blur-sm ${activeNoteColor ? '' : 'bg-white/85 dark:bg-gray-900/85'} ${activeNotePhoto ? 'bg-cover bg-center [--note-tint:rgb(255_255_255/0.75)] dark:[--note-tint:rgb(17_24_39/0.75)]' : ''}`}
                        style={activeNoteStyle}
                    >
                        {activeNotePhoto && (
                            <PhotoCredit
                                background={activeNotePhoto}
                                className="absolute bottom-2 right-3 z-10"
                            />
                        )}
                        {isEditing && editingNote ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex items-start justify-between mb-3 flex-shrink-0 px-6 md:px-8 pt-5">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={editingNote.title || ''}
                                            onChange={(e) =>
                                                handleNoteChange({
                                                    title: e.target.value,
                                                })
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder={t('notes.titlePlaceholder')}
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
                                            autoFocus={!editingNote.uid}
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
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => setIsFocusMode(true)}
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
                                            aria-label={t('notes.focusMode')}
                                            title={t('notes.focusMode')}
                                        >
                                            <ArrowsPointingOutIcon className="h-5 w-5" />
                                        </button>
                                        {editingNote.uid && (
                                            <button
                                                onClick={() =>
                                                    setNoteToShare(editingNote)
                                                }
                                                className={`p-2 transition ${
                                                    editingNote.is_public
                                                        ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                                                        : 'text-gray-400 dark:text-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                                style={{
                                                    color:
                                                        editingNoteColor &&
                                                        !editingNote.is_public
                                                            ? shouldUseLightText(
                                                                  editingNoteColor
                                                              )
                                                                ? '#e0e0e0'
                                                                : '#333333'
                                                            : undefined,
                                                }}
                                                aria-label={t(
                                                    'notes.publicShare.open',
                                                    'Share note'
                                                )}
                                                title={
                                                    editingNote.is_public
                                                        ? t(
                                                              'notes.publicShare.sharedTitle',
                                                              'Shared with anyone who has the link'
                                                          )
                                                        : t(
                                                              'notes.publicShare.open',
                                                              'Share note'
                                                          )
                                                }
                                                data-testid="note-share-button"
                                            >
                                                <GlobeAltIcon className="h-5 w-5" />
                                            </button>
                                        )}
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
                                            aria-label={t('notes.noteOptions')}
                                        >
                                            <EllipsisVerticalIcon className="h-5 w-5" />
                                        </button>
                                        {showNoteOptionsDropdown && (
                                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                                        Background Color
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {COLORS.map(
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
                                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-2">
                                                        {t(
                                                            'notes.backgroundImage',
                                                            'Background'
                                                        )}
                                                    </div>
                                                    <NoteBackgroundPicker
                                                        value={
                                                            editingNote.background
                                                        }
                                                        onChange={(bg) =>
                                                            handleBackgroundChange(
                                                                bg,
                                                                editingNote
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            if (
                                                                editingNote.title
                                                            ) {
                                                                debouncedSave.flush();
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
                                                        {t('notes.save', 'Save')}
                                                    </button>
                                                    {editingNote.uid && (
                                                        <button
                                                            onClick={() => {
                                                                handleTogglePin(editingNote);
                                                                setShowNoteOptionsDropdown(false);
                                                            }}
                                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                        >
                                                            <PushPinIcon className="h-4 w-4" />
                                                            {editingNote.pin_to_sidebar
                                                                ? t('notes.unpinFromSidebar', 'Unpin from sidebar')
                                                                : t('notes.pinToSidebar', 'Pin to sidebar')}
                                                        </button>
                                                    )}
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
                                            className={`${FORM.select} w-full`}
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

                                {/* The editor keeps a 24px gutter for the block
                                    handle, so its text lines up with the title. */}
                                <div className="flex-1 overflow-y-auto pl-0 pr-6 md:pl-2 md:pr-8 py-4">
                                    <MarkdownEditor
                                        noteUid={editingNote.uid}
                                        value={editingNote.content || ''}
                                        onChange={(val) =>
                                            handleNoteChange({ content: val })
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder={t('notes.contentPlaceholder')}
                                        noteColor={editingNoteColor}
                                        minHeight="300px"
                                    />
                                </div>
                            </div>
                        ) : previewNote ? null : sortedNotes.length > 0 ? (
                            // No note selected yet (mobile lands here since
                            // it skips auto-selecting the most recent note,
                            // and desktop briefly does too before that
                            // effect runs). Show every note to pick from
                            // instead of a dead-end placeholder (#1527).
                            <div className="flex-1 overflow-y-auto p-6">
                                {notesHeader}
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {sortedNotes.map((note) => (
                                        <NoteCard
                                            key={note.uid}
                                            note={note}
                                            showActions={false}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : hasLoaded ? (
                            <div className="flex-1 overflow-y-auto p-6">
                                {notesHeader}
                                <BlankSlate
                                    title={t('notes.noNotesYet', 'No notes yet.')}
                                    hint={t(
                                        'notes.blankSlateHint',
                                        'Notes hold what you want to keep, like meeting notes, ideas or reference material. Write in Markdown, link a note to a project and tag it to find it later.'
                                    )}
                                    actions={[
                                        {
                                            label: t(
                                                'notes.blankSlateNew',
                                                'Write your first note'
                                            ),
                                            icon: PlusIcon,
                                            onClick: startNewNote,
                                        },
                                        {
                                            label: t(
                                                'notes.blankSlateProjects',
                                                'Go to projects'
                                            ),
                                            icon: FolderIcon,
                                            to: '/projects',
                                        },
                                    ]}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                {isFocusMode && editingNote && (
                    <NoteFocusMode
                        note={editingNote}
                        isEditing
                        saveStatus={saveStatus}
                        onNoteChange={handleNoteChange}
                        onEditNote={() => undefined}
                        onExitEditing={() => {
                            debouncedSave.flush();
                            setIsFocusMode(false);
                        }}
                        onClose={() => setIsFocusMode(false)}
                    />
                )}

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

                <PublicShareModal
                    isOpen={!!noteToShare}
                    onClose={() => setNoteToShare(null)}
                    noteUid={noteToShare?.uid ?? null}
                    noteTitle={noteToShare?.title}
                    onChange={(isPublic) => {
                        const uid = noteToShare?.uid;
                        if (!uid) return;
                        setNotes(
                            notes.map((n) =>
                                n.uid === uid ? { ...n, is_public: isPublic } : n
                            )
                        );
                        if (editingNote?.uid === uid) {
                            setEditingNote({ ...editingNote, is_public: isPublic });
                        }
                    }}
                />

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
