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
import NotesOverview from './Note/NotesOverview';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';
import { noteMatchesFocus, useFocus } from '../utils/focus';
import FocusEmptyHint from './Focus/FocusEmptyHint';

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
    const focus = useFocus();
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
    // /notes is the table of notes; /notes/:uid is the editor.
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
    const blankNoteOpen = !!(location.state as { blankNote?: boolean } | null)
        ?.blankNote;
    const newNoteSignalRef = useRef<number | null>(null);
    // Set once the user has left a blank note, so its save still landing
    // doesn't pull them back into the editor.
    const leftBlankNoteRef = useRef(false);

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

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // The create request of the blank note being written, so a save that
    // fires while it is in flight updates that note instead of creating a
    // second one. Reset when another blank note is started.
    const pendingCreateRef = useRef<Promise<Note> | null>(null);

    // Saves a note and returns the stored copy plus whether it was created.
    // Reads the notes list from the store, as this can run after unmount.
    const persistNote = async (
        noteToSave: Note
    ): Promise<{ saved: Note; created: boolean }> => {
        if (noteToSave.tags && noteToSave.tags.length > 0) {
            const { tagsStore } = useStore.getState();
            tagsStore.addNewTags(noteToSave.tags.map((t) => t.name));
        }

        let target = noteToSave;
        if (!target.uid && pendingCreateRef.current) {
            const created = await pendingCreateRef.current.catch(() => null);
            if (created) {
                target = { ...target, id: created.id, uid: created.uid };
            }
        }

        const currentNotes = useStore.getState().notesStore.notes;
        if (target.uid) {
            const saved = await updateNote(target.uid, target);
            setNotes(
                currentNotes.map((n) => (n.uid === saved.uid ? saved : n))
            );
            return { saved, created: false };
        }

        const request = createNote(target);
        pendingCreateRef.current = request;
        try {
            const saved = await request;
            setNotes([saved, ...useStore.getState().notesStore.notes]);
            return { saved, created: true };
        } catch (err) {
            if (pendingCreateRef.current === request) {
                pendingCreateRef.current = null;
            }
            throw err;
        }
    };

    // flushOnExit: leaving Notes (or the whole page) inside the debounce
    // window still saves what was typed since the last save.
    const debouncedSave = useDebouncedCallback(
        async (noteToSave: Note) => {
            if (!noteToSave.title) return;

            try {
                setSaveStatus('saving');
                const { saved, created } = await persistNote(noteToSave);
                if (!isMountedRef.current) return;
                setEditingNote((current) => mergeSavedNote(current, saved));
                if (created && !leftBlankNoteRef.current) {
                    navigate(`/notes/${saved.uid}`, { replace: true });
                }
                setSaveStatus('saved');
            } catch (err) {
                console.error('Error autosaving note:', err);
                if (isMountedRef.current) setSaveStatus('unsaved');
            }
        },
        1000,
        { flushOnExit: true }
    );

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
                debouncedSave.cancel();
                try {
                    await persistNote(editingNote);
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
        } else {
            navigate('/notes', { replace: true });
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

    // A Focus narrows the list in memory; the store keeps every note
    const sortedNotes = useMemo(
        () =>
            sortNotesByOrder(
                focus
                    ? notes.filter((note) =>
                          noteMatchesFocus(note, focus, projects)
                      )
                    : notes,
                orderBy
            ),
        [notes, orderBy, focus, projects]
    );

    const startNewNote = useCallback(() => {
        // Fresh blank note opened straight in the inline editor; nothing is
        // persisted until the user types a title and saves. A Focus project
        // is filled in so the note lands where the user is working.
        const focusProject = focus?.project_uid
            ? projects.find((project) => project.uid === focus.project_uid)
            : undefined;
        debouncedSave.flush();
        pendingCreateRef.current = null;
        leftBlankNoteRef.current = false;
        setPreviewNote(null);
        setEditingNote({
            title: '',
            content: '',
            ...(focusProject
                ? {
                      project_uid: focusProject.uid,
                      project: {
                          id: focusProject.id as number,
                          uid: focusProject.uid,
                          name: focusProject.name,
                      },
                  }
                : {}),
        });
        setIsEditing(true);
        setSaveStatus('saved');
        setIsFocusMode(false);
    }, [focus, projects, debouncedSave]);

    // Open a blank editor when navigated here with the "new note" flag
    // (sidebar + button, footer create menu, keyboard shortcut). The ref
    // deduplicates React 18 StrictMode's double effect invocation.
    useEffect(() => {
        if (newNoteSignal && newNoteSignalRef.current !== newNoteSignal) {
            newNoteSignalRef.current = newNoteSignal;
            startNewNote();
            navigate('/notes', { replace: true, state: { blankNote: true } });
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

    // The note in the URL is unavailable: go to the table once the list has
    // loaded.
    useEffect(() => {
        if (!urlNoteMissing || !uid || !hasLoaded || previewNote) return;
        navigate('/notes', { replace: true });
    }, [urlNoteMissing, uid, hasLoaded, previewNote, navigate]);

    // Arriving at plain /notes (sidebar, breadcrumb, Back) closes whatever is
    // open and shows the table. A blank note being written lives at /notes as
    // well and marks itself in the location state.
    useEffect(() => {
        if (uid || newNoteSignal || blankNoteOpen) return;
        if (!isEditing && !previewNote) return;
        leftBlankNoteRef.current = true;
        leaveEditing();
        setPreviewNote(null);
        setSaveStatus('saved');
        setIsFocusMode(false);
    }, [location.key]);

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

    // The same route as the sidebar's + button, so Back and the breadcrumb
    // return to the table.
    const openNewNote = () =>
        navigate('/notes', { state: { newNote: Date.now() } });

    const notesHeader = (
        <div className="flex items-center justify-between gap-2 mb-8">
            <h2 className="text-2xl font-light">{t('notes.title', 'Notes')}</h2>
            <NewItemButton
                label={t('notes.new', 'New Note')}
                onClick={openNewNote}
                testId="new-note-button"
            />
        </div>
    );

    // The table and the empty state sit like every other list page; an open
    // note keeps the edge-to-edge editor with its color and photo.
    const showsList = !(isEditing && editingNote) && !previewNote;

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
                className={`flex-1 flex flex-col min-h-0 overflow-hidden ${showsList ? 'pt-4 md:px-4' : 'pt-2'}`}
            >
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        className={`relative flex flex-1 flex-col overflow-hidden h-full ${showsList ? '' : 'backdrop-blur-sm'} ${activeNoteColor || showsList ? '' : 'bg-white/85 dark:bg-gray-900/85'} ${activeNotePhoto ? 'bg-cover bg-center [--note-tint:rgb(255_255_255/0.75)] dark:[--note-tint:rgb(17_24_39/0.75)]' : ''}`}
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
                            <NotesOverview onNewNote={openNewNote} />
                        ) : hasLoaded ? (
                            <div className="flex-1 overflow-y-auto">
                                <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
                                    <div className="w-full max-w-7xl mx-auto">
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
                                                    onClick: openNewNote,
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
                                        <FocusEmptyHint className="mx-auto mt-4 max-w-md" />
                                    </div>
                                </div>
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
