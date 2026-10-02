import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

interface MissingNotePromptProps {
    x: number;
    y: number;
    title: string;
    onCreate: () => void;
    onClose: () => void;
}

// Asks whether to create the note a [[link]] points to when no note has
// that title. Enter creates it, Escape dismisses, any other key keeps typing.
const MissingNotePrompt: React.FC<MissingNotePromptProps> = ({
    x,
    y,
    title,
    onCreate,
    onClose,
}) => {
    const { t } = useTranslation();
    const promptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!promptRef.current?.contains(e.target as Node)) onClose();
        };
        window.addEventListener('mousedown', handler, true);
        return () => window.removeEventListener('mousedown', handler, true);
    }, [onClose]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onCreate();
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [onCreate, onClose]);

    const PROMPT_HEIGHT = 96;
    const top =
        window.innerHeight - y > PROMPT_HEIGHT + 16
            ? y + 22
            : y - PROMPT_HEIGHT - 4;

    return ReactDOM.createPortal(
        <div
            ref={promptRef}
            role="dialog"
            data-testid="missing-note-prompt"
            className="fixed z-[300] bg-white dark:bg-gray-800 rounded-lg shadow-xl px-3 py-2.5"
            style={{ left: x, top, minWidth: 220, maxWidth: 320 }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                {t(
                    'notes.linkedNoteMissing',
                    'No note called "{{title}}" yet. Create it?',
                    { title }
                )}
            </p>
            <div className="mt-2 flex justify-end gap-2">
                <button
                    type="button"
                    className="px-2.5 py-1 text-xs rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onClose();
                    }}
                >
                    {t('notes.linkedNoteNotNow', 'Not now')}
                </button>
                <button
                    type="button"
                    className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onCreate();
                    }}
                >
                    {t('notes.linkedNoteCreate', 'Create note')}
                </button>
            </div>
        </div>,
        document.body
    );
};

export default MissingNotePrompt;
