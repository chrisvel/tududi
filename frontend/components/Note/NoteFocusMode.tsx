import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { Note } from '../../entities/Note';
import { ENABLE_NOTE_COLOR } from '../../config/featureFlags';

const shouldUseLightText = (hexColor: string | undefined): boolean => {
    if (!hexColor) return false;
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.4;
};

interface NoteFocusModeProps {
    note: Note;
    isEditing: boolean;
    saveStatus: 'saved' | 'saving' | 'unsaved';
    onNoteChange: (updates: Partial<Note>) => void;
    onContentChange?: (newContent: string) => void;
    onEditNote: () => void;
    onExitEditing: () => void;
    onClose: () => void;
}

const NoteFocusMode: React.FC<NoteFocusModeProps> = ({
    note,
    isEditing,
    saveStatus,
    onNoteChange,
    onContentChange,
    onEditNote,
    onExitEditing,
    onClose,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const noteColor = ENABLE_NOTE_COLOR ? note.color : undefined;
    const lightText = shouldUseLightText(noteColor);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (isEditing) {
                    onExitEditing();
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isEditing, onExitEditing, onClose]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    const textColor = noteColor
        ? lightText
            ? '#ffffff'
            : '#333333'
        : undefined;
    const mutedColor = noteColor
        ? lightText
            ? '#e0e0e0'
            : '#666666'
        : undefined;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900 transition-opacity duration-200"
            style={noteColor ? { backgroundColor: noteColor } : undefined}
        >
            {/* Minimal header */}
            <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
                <div className="text-xs">
                    {isEditing && note.title && (
                        <>
                            {saveStatus === 'saving' && (
                                <span
                                    className="text-blue-500 dark:text-blue-400 italic"
                                    style={mutedColor ? { color: mutedColor } : undefined}
                                >
                                    Saving...
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span
                                    className="text-gray-400 dark:text-gray-500"
                                    style={mutedColor ? { color: mutedColor } : undefined}
                                >
                                    Saved
                                </span>
                            )}
                            {saveStatus === 'unsaved' && (
                                <span
                                    className="text-amber-600 dark:text-amber-400"
                                    style={mutedColor ? { color: mutedColor } : undefined}
                                >
                                    Unsaved
                                </span>
                            )}
                        </>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    style={mutedColor ? { color: mutedColor } : undefined}
                    aria-label="Exit focus mode"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Centered content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 md:px-8 pb-16">
                    {isEditing ? (
                        <>
                            <input
                                type="text"
                                value={note.title || ''}
                                onChange={(e) =>
                                    onNoteChange({ title: e.target.value })
                                }
                                placeholder="Note title..."
                                className="w-full bg-transparent text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-0 mb-6"
                                style={{
                                    ...(textColor ? { color: textColor } : {}),
                                    fontSize: '2.25rem',
                                    lineHeight: '2.5rem',
                                    fontWeight: 500,
                                    paddingLeft: 0,
                                    paddingRight: 0,
                                }}
                            />
                            <textarea
                                ref={textareaRef}
                                value={note.content || ''}
                                onChange={(e) =>
                                    onNoteChange({ content: e.target.value })
                                }
                                placeholder="Write your note... (Markdown supported)"
                                className="w-full h-full min-h-[60vh] bg-transparent text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-0 resize-none text-lg leading-relaxed"
                                style={textColor ? { color: textColor } : undefined}
                            />
                        </>
                    ) : (
                        <>
                            <h1
                                onClick={onEditNote}
                                className="cursor-pointer text-gray-900 dark:text-gray-100 mb-6"
                                style={{
                                    ...(textColor ? { color: textColor } : {}),
                                    fontSize: '2.25rem',
                                    lineHeight: '2.5rem',
                                    fontWeight: 500,
                                }}
                                title="Click to edit"
                            >
                                {note.title || 'Untitled Note'}
                            </h1>
                            <div
                                onClick={onEditNote}
                                className="cursor-pointer text-gray-900 dark:text-gray-100 text-lg leading-relaxed"
                                style={textColor ? { color: textColor } : undefined}
                                title="Click to edit"
                            >
                                <MarkdownRenderer
                                    content={note.content}
                                    noteColor={noteColor}
                                    onContentChange={onContentChange}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default NoteFocusMode;
