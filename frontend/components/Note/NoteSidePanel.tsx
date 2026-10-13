import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import {
    ArrowTopRightOnSquareIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import NoteEditorView from './NoteEditorView';
import NoteFocusMode from './NoteFocusMode';
import PublicShareModal from './PublicShareModal';
import PhotoCredit from '../Shared/PhotoCredit';
import { updateNote } from '../../utils/notesService';
import { getApiPath } from '../../config/paths';
import { useStore } from '../../store/useStore';
import {
    contentBackgroundUrl,
    findContentBackground,
} from '../../constants/contentBackgrounds';

interface NoteSidePanelProps {
    note: Note;
    onClose: () => void;
    onSaved: (note: Note) => void;
    onDelete?: (note: Note) => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

const SLIDE_MS = 200;

const isHexColor = (value?: string | null): value is string =>
    !!value && /^#[0-9a-f]{6}$/i.test(value);

// A note opened beside the page it belongs to. It shows the same note view
// as the Notes page and saves a second after typing stops.
const NoteSidePanel: React.FC<NoteSidePanelProps> = ({
    note,
    onClose,
    onSaved,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<Note>(note);
    const [loaded, setLoaded] = useState(Boolean(note.content));
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    // Drives the slide in on open and the slide out before closing
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    // Set once the user edits, so a late fetch never overwrites their edits
    const dirtyRef = useRef(false);

    // Lists may carry notes without their body, so fetch the whole note.
    useEffect(() => {
        if (!note.uid) return;
        let cancelled = false;
        dirtyRef.current = false;
        setDraft(note);
        setSaveStatus('saved');
        fetch(getApiPath(`note/${note.uid}`), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (!cancelled && data && !dirtyRef.current) setDraft(data);
            })
            .catch(() => {
                // The panel keeps whatever content the list had.
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [note.uid]);

    const save = useDebouncedCallback(async (next: Note) => {
        if (!next.uid || !next.title?.trim()) return;
        try {
            setSaveStatus('saving');
            if (next.tags && next.tags.length > 0) {
                useStore
                    .getState()
                    .tagsStore.addNewTags(next.tags.map((tag) => tag.name));
            }
            const saved = await updateNote(next.uid, next);
            setSaveStatus('saved');
            onSaved(saved);
        } catch (err) {
            console.error('Error saving note:', err);
            setSaveStatus('unsaved');
        }
    }, 1000);

    const change = (updates: Partial<Note>) => {
        dirtyRef.current = true;
        const next = { ...draft, ...updates };
        setDraft(next);
        setSaveStatus('unsaved');
        save(next);
    };

    // Color, background and pin are single clicks, so they save right away.
    const changeNow = (updates: Partial<Note>) => {
        change(updates);
        save.flush();
    };

    const close = () => {
        save.flush();
        setShown(false);
        window.setTimeout(onClose, SLIDE_MS);
    };

    // Same look as the open note on the Notes page.
    const color = draft.color || undefined;
    const tint = isHexColor(color) ? `${color}d9` : color;
    const photo = findContentBackground(draft.background ?? null);
    const panelStyle: React.CSSProperties = photo
        ? ({
              backgroundImage: `linear-gradient(var(--note-tint), var(--note-tint)), url(${contentBackgroundUrl(photo)})`,
              ...(isHexColor(color) ? { '--note-tint': `${color}bf` } : {}),
          } as React.CSSProperties)
        : { backgroundColor: tint };
    const iconButton =
        'p-2 text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400';

    return createPortal(
        <>
            <div
                aria-hidden="true"
                className={`fixed inset-0 z-[55] bg-gray-900/20 transition-opacity duration-200 motion-reduce:transition-none dark:bg-black/40 ${
                    shown ? 'opacity-100' : 'opacity-0'
                }`}
                onMouseDown={close}
            />
            <aside
                className={`fixed inset-y-0 right-0 z-[60] flex w-full flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-[40rem] ${
                    shown ? 'translate-x-0' : 'translate-x-full'
                } ${
                    color ? '' : 'bg-white dark:bg-gray-900'
                } ${photo ? 'bg-cover bg-center [--note-tint:rgb(255_255_255/0.75)] dark:[--note-tint:rgb(17_24_39/0.75)]' : ''}`}
                style={panelStyle}
                role="dialog"
                aria-label={draft.title || t('notes.untitled', 'Untitled')}
            >
                {photo && (
                    <PhotoCredit
                        background={photo}
                        className="absolute bottom-2 right-3 z-10"
                    />
                )}
                {loaded ? (
                    <NoteEditorView
                        note={draft}
                        saveStatus={saveStatus}
                        onChange={change}
                        onLookChange={changeNow}
                        onSaveNow={() => save.flush()}
                        onTogglePin={() =>
                            changeNow({ pin_to_sidebar: !draft.pin_to_sidebar })
                        }
                        onDelete={() => {
                            save.cancel();
                            onDelete?.(draft);
                        }}
                        onShare={() => setIsShareOpen(true)}
                        onOpenFocusMode={() => setIsFocusMode(true)}
                        headerActions={
                            <>
                                {draft.uid && (
                                    <Link
                                        to={`/notes/${draft.uid}`}
                                        onClick={() => save.flush()}
                                        className={iconButton}
                                        aria-label={t(
                                            'notes.openInNotes',
                                            'Open in Notes'
                                        )}
                                        title={t(
                                            'notes.openInNotes',
                                            'Open in Notes'
                                        )}
                                    >
                                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    onClick={close}
                                    className={iconButton}
                                    aria-label={t('common.close', 'Close')}
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </>
                        }
                    />
                ) : (
                    <p className="p-6 text-sm text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                )}
            </aside>

            {isFocusMode && (
                <NoteFocusMode
                    note={draft}
                    isEditing
                    saveStatus={saveStatus}
                    onNoteChange={change}
                    onEditNote={() => undefined}
                    onExitEditing={() => {
                        save.flush();
                        setIsFocusMode(false);
                    }}
                    onClose={() => setIsFocusMode(false)}
                />
            )}

            {/* Lifted above the panel, which sits over the navbar */}
            <div className="relative z-[70]">
                <PublicShareModal
                    isOpen={isShareOpen}
                    onClose={() => setIsShareOpen(false)}
                    noteUid={draft.uid || null}
                    noteTitle={draft.title}
                    onChange={(isPublic) => {
                        setDraft((current) => ({
                            ...current,
                            is_public: isPublic,
                        }));
                        onSaved({ ...draft, is_public: isPublic });
                    }}
                />
            </div>
        </>,
        document.body
    );
};

export default NoteSidePanel;
