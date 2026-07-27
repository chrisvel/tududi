import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { EditorView } from '@codemirror/view';

export interface NoteTitle {
    uid: string;
    title: string;
}

interface WikilinkMenuProps {
    x: number;
    y: number;
    filter: string;
    triggerFrom: number;
    triggerTo: number;
    view: EditorView;
    noteTitles: NoteTitle[];
    onClose: () => void;
}

function filterNotes(notes: NoteTitle[], filter: string): NoteTitle[] {
    if (!filter) return notes.slice(0, 10);
    const q = filter.toLowerCase();
    return notes
        .filter((n) => n.title.toLowerCase().includes(q))
        .slice(0, 10);
}

const WikilinkMenu: React.FC<WikilinkMenuProps> = ({
    x,
    y,
    filter,
    triggerFrom,
    triggerTo,
    view,
    noteTitles,
    onClose,
}) => {
    const matches = filterNotes(noteTitles, filter);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeItemRef = useRef<HTMLButtonElement | null>(null);

    const clampedIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));

    useEffect(() => {
        setActiveIndex(0);
    }, [filter]);

    useEffect(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest' });
    }, [clampedIndex]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (matches.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % matches.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const note = matches[clampedIndex];
                if (note) {
                    insertWikilink(note.title, view, triggerFrom, triggerTo);
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [matches, clampedIndex, view, triggerFrom, triggerTo, onClose]);

    if (matches.length === 0 && !filter) return null;

    const MENU_HEIGHT = Math.min(matches.length, 8) * 40;
    const spaceBelow = window.innerHeight - y;
    const top = spaceBelow > MENU_HEIGHT + 16 ? y + 4 : y - MENU_HEIGHT - 4;

    return ReactDOM.createPortal(
        <div
            className="fixed z-[300] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-y-auto"
            style={{ left: x, top, minWidth: 200, maxWidth: 320, maxHeight: 320 }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {matches.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">
                    No matching notes
                </div>
            ) : (
                matches.map((note, i) => (
                    <button
                        key={note.uid}
                        ref={i === clampedIndex ? activeItemRef : null}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                            i === clampedIndex
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            insertWikilink(note.title, view, triggerFrom, triggerTo);
                            onClose();
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                    >
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                            [[
                        </span>
                        <span className="flex-1 text-sm font-medium truncate">
                            {note.title}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                            ]]
                        </span>
                    </button>
                ))
            )}
        </div>,
        document.body
    );
};

function insertWikilink(
    title: string,
    view: EditorView,
    from: number,
    to: number
) {
    const insertion = `[[${title}]]`;
    view.dispatch({
        changes: { from, to, insert: insertion },
        selection: { anchor: from + insertion.length },
    });
    view.focus();
}

export default WikilinkMenu;
