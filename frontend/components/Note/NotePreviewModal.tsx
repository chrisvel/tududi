import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Note } from '../../entities/Note';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { getApiPath } from '../../config/paths';

interface NotePreviewModalProps {
    note: Note;
    onClose: () => void;
    onEdit: (note: Note) => void;
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const NotePreviewModal: React.FC<NotePreviewModalProps> = ({
    note,
    onClose,
    onEdit,
}) => {
    const { t } = useTranslation();
    const [fullNote, setFullNote] = useState<Note>(note);
    const [loading, setLoading] = useState(!note.content);

    // Lists may carry notes without their body, so fetch the whole note.
    useEffect(() => {
        if (!note.uid) return;
        let cancelled = false;
        fetch(getApiPath(`note/${note.uid}`), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (!cancelled && data) setFullNote(data);
            })
            .catch(() => {
                // The preview keeps whatever content the list had.
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [note.uid]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const tags = fullNote.tags || fullNote.Tags || [];
    const title = fullNote.title || t('notes.untitled', 'Untitled');

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900"
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="flex items-start gap-3 px-6 pb-3 pt-5">
                    <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {fullNote.updated_at && (
                                <span>
                                    {t('notes.editedOn', 'Edited {{date}}', {
                                        date: format(
                                            new Date(fullNote.updated_at),
                                            'MMM d, yyyy'
                                        ),
                                    })}
                                </span>
                            )}
                            {tags.map((tag) => (
                                <Link
                                    key={tag.uid || tag.id || tag.name}
                                    to={
                                        tag.uid
                                            ? `/tag/${tag.uid}-${slugify(tag.name)}`
                                            : `/tag/${encodeURIComponent(tag.name)}`
                                    }
                                    onClick={onClose}
                                    className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onEdit(fullNote)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                        {t('common.edit', 'Edit')}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="min-h-[6rem] overflow-y-auto px-6 pb-6">
                    {loading ? (
                        <p className="text-sm text-gray-400">
                            {t('common.loading', 'Loading...')}
                        </p>
                    ) : fullNote.content?.trim() ? (
                        <MarkdownRenderer
                            content={fullNote.content}
                            noteColor={fullNote.color}
                        />
                    ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('notes.emptyNote', 'This note is empty.')}
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default NotePreviewModal;
