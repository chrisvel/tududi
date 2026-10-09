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
import { FolderIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useToast } from './Shared/ToastContext';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import NoteModal from './Note/NoteModal';
import PublicShareModal from './Note/PublicShareModal';
import ConfirmDialog from './Shared/ConfirmDialog';
import DiscardChangesDialog from './Shared/DiscardChangesDialog';
import { Note } from '../entities/Note';
import { createNote, updateNote, fetchNoteBySlug } from '../utils/notesService';
import { deleteNoteWithStoreUpdate } from '../utils/noteDeleteUtils';
import { useStore } from '../store/useStore';
import { createProject } from '../utils/projectsService';
import { sortNotesByOrder } from '../utils/notesTreeUtils';
import PhotoCredit from './Shared/PhotoCredit';
import {
    contentBackgroundUrl,
    findContentBackground,
} from '../constants/contentBackgrounds';
import NoteFocusMode from './Note/NoteFocusMode';
import NoteEditorView from './Note/NoteEditorView';
import NoteCard from './Shared/NoteCard';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';

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
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [saveStatus, setSaveStatus] = useState<
        'saved' | 'saving' | 'unsaved'
    >('saved');
    const [isFocusMode, setIsFocusMode] = useState(false);
    const hasAutoSelected = useRef(false);
    const currentUidRef = useRef(uid);
    const [urlNoteMissing, setUrlNoteMissing] = useState(false);
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
        (isEditing ? editingNote?.background : previewNote?.background) ?? null
    );
    const activeNoteStyle: React.CSSProperties = activeNotePhoto
        ? ({
              backgroundImage: `linear-gradient(var(--note-tint), var(--note-tint)), url(${contentBackgroundUrl(activeNotePhoto)})`,
              ...(activeNoteColor && /^#[0-9a-f]{6}$/i.test(activeNoteColor)
                  ? { '--note-tint': `${activeNoteColor}bf` }
                  : {}),
          } as React.CSSProperties)
        : { backgroundColor: activeNoteBackground || undefined };

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
                setEditingNote((current) => mergeSavedNote(current, savedNote));
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
        if (previewNote) {
            handleSelectNote(previewNote);
        }
    };

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
        setNotes(
            notes.map((n) =>
                n.uid === note.uid ? { ...n, pin_to_sidebar: newValue } : n
            )
        );

        try {
            await updateNote(note.uid, { pin_to_sidebar: newValue } as any);
        } catch (err) {
            console.error('Error toggling pin:', err);
            if (previewNote?.uid === note.uid) setPreviewNote(note);
            if (editingNote?.uid === note.uid) setEditingNote(note);
            setNotes(
                notes.map((n) =>
                    n.uid === note.uid ? { ...n, pin_to_sidebar: !newValue } : n
                )
            );
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
        setIsFocusMode(false);
    }, []);

    // Open a blank editor when navigated here with the "new note" flag
    // (sidebar + button, footer create menu, keyboard shortcut). The ref
    // deduplicates React 18 StrictMode's double effect invocation.
    useEffect(() => {
        if (newNoteSignal && newNoteSignalRef.current !== newNoteSignal) {
            newNoteSignalRef.current = newNoteSignal;
            startNewNote();
            navigate('/notes', { replace: true, state: {} });
        }
    }, [newNoteSignal, startNewNote, navigate]);

    useEffect(() => {
        hasAutoSelected.current = false;
        currentUidRef.current = uid;
    }, [uid]);

    useEffect(() => {
        if (newNoteSignal) return;
        if (!uid || hasAutoSelected.current) return;

        const noteFromUrl = hasLoaded
            ? sortedNotes.find((note) => note.uid === uid)
            : undefined;
        if (noteFromUrl) {
            setPreviewNote(noteFromUrl);
            hasAutoSelected.current = true;
            return;
        }

        // Fetch the note directly instead of waiting for the full notes
        // list (#1785). This also covers notes missing from a stale cached
        // list, e.g. a project shared with us after it was loaded (#1523).
        hasAutoSelected.current = true;
        setUrlNoteMissing(false);
        fetchNoteBySlug(uid)
            .then((fetchedNote) => {
                if (!fetchedNote) throw new Error('Note not found');
                if (currentUidRef.current !== uid) return;
                const { notesStore } = useStore.getState();
                if (
                    notesStore.hasLoaded &&
                    !notesStore.notes.some((n) => n.uid === fetchedNote.uid)
                ) {
                    setNotes([fetchedNote, ...notesStore.notes]);
                }
                setPreviewNote(fetchedNote);
            })
            .catch(() => {
                if (currentUidRef.current === uid) setUrlNoteMissing(true);
            });
    }, [uid, sortedNotes, hasLoaded]);

    // The direct fetch can finish before the list does. Once the list is
    // in, add the open note to it if it's missing so the rest of the page
    // knows about it.
    useEffect(() => {
        if (!hasLoaded || !previewNote?.uid) return;
        if (!notes.some((n) => n.uid === previewNote.uid)) {
            setNotes([previewNote, ...notes]);
        }
    }, [hasLoaded]);

    // The note in the URL is unavailable: fall back to the first note once
    // the list has loaded.
    useEffect(() => {
        if (!urlNoteMissing || !hasLoaded || previewNote) return;
        const isDesktop = window.innerWidth >= 768;
        if (isDesktop && sortedNotes.length > 0) {
            handleSelectNote(sortedNotes[0]);
        }
    }, [urlNoteMissing, hasLoaded, sortedNotes, previewNote]);

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
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isEditing) {
                e.preventDefault();
                debouncedSave.flush();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isEditing, debouncedSave]);

    // A note opened by link renders as soon as it arrives, without waiting
    // for the full notes list. Until then keep the pane empty rather than
    // flashing a loader or the empty state.
    const waitingForLinkedNote =
        !!uid && !previewNote && !isEditing && !urlNoteMissing && !isError;
    if (waitingForLinkedNote) {
        return <div className="w-full h-full" />;
    }

    if ((isLoading || (!hasLoaded && !isError)) && !previewNote && !isEditing) {
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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        className={`relative flex flex-1 flex-col overflow-hidden h-full backdrop-blur-sm ${activeNoteColor ? '' : 'bg-white/85 dark:bg-gray-900/85'} ${activeNotePhoto ? 'bg-cover bg-center [--note-tint:rgb(255_255_255/0.75)] dark:[--note-tint:rgb(17_24_39/0.75)]' : ''}`}
                        style={activeNoteStyle}
                    >
                        {activeNotePhoto && (
                            <PhotoCredit
                                background={activeNotePhoto}
                                className="absolute bottom-2 right-3 z-10"
                            />
                        )}
                        {isEditing && editingNote ? (
                            <NoteEditorView
                                note={editingNote}
                                saveStatus={saveStatus}
                                onChange={handleNoteChange}
                                onLookChange={(changes) =>
                                    handleLookChange(changes, editingNote)
                                }
                                onSaveNow={() => {
                                    if (editingNote.title) {
                                        debouncedSave.flush();
                                    } else {
                                        setShowDiscardDialog(true);
                                    }
                                }}
                                onTogglePin={() => handleTogglePin(editingNote)}
                                onDelete={() => {
                                    setNoteToDelete(editingNote);
                                    setIsConfirmDialogOpen(true);
                                }}
                                onShare={() => setNoteToShare(editingNote)}
                                onOpenFocusMode={() => setIsFocusMode(true)}
                            />
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
                                    title={t(
                                        'notes.noNotesYet',
                                        'No notes yet.'
                                    )}
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
                                n.uid === uid
                                    ? { ...n, is_public: isPublic }
                                    : n
                            )
                        );
                        if (editingNote?.uid === uid) {
                            setEditingNote({
                                ...editingNote,
                                is_public: isPublic,
                            });
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
