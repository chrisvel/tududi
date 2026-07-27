import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { EditorView } from '@codemirror/view';

export interface SlashCommand {
    id: string;
    label: string;
    description: string;
    keywords: string[];
    icon: string;
    insert: (view: EditorView, from: number, to: number) => void;
}

function makeInserter(text: string, cursorOffset = 0) {
    return (view: EditorView, from: number, to: number) => {
        view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length + cursorOffset },
        });
        view.focus();
    };
}

export const SLASH_COMMANDS: SlashCommand[] = [
    {
        id: 'h1',
        label: 'Heading 1',
        description: 'Large section heading',
        keywords: ['h1', 'heading', 'heading1', 'title'],
        icon: 'H1',
        insert: makeInserter('# '),
    },
    {
        id: 'h2',
        label: 'Heading 2',
        description: 'Medium section heading',
        keywords: ['h2', 'heading', 'heading2', 'subtitle'],
        icon: 'H2',
        insert: makeInserter('## '),
    },
    {
        id: 'h3',
        label: 'Heading 3',
        description: 'Small section heading',
        keywords: ['h3', 'heading', 'heading3'],
        icon: 'H3',
        insert: makeInserter('### '),
    },
    {
        id: 'bold',
        label: 'Bold',
        description: 'Bold text',
        keywords: ['bold', 'strong', 'b'],
        icon: 'B',
        insert: makeInserter('****', -2),
    },
    {
        id: 'italic',
        label: 'Italic',
        description: 'Italic text',
        keywords: ['italic', 'em', 'i'],
        icon: 'I',
        insert: makeInserter('__', -1),
    },
    {
        id: 'strikethrough',
        label: 'Strikethrough',
        description: 'Strike through text',
        keywords: ['strikethrough', 'strike', 'del'],
        icon: 'S̶',
        insert: makeInserter('~~~~', -2),
    },
    {
        id: 'code',
        label: 'Inline Code',
        description: 'Inline code snippet',
        keywords: ['code', 'inline', 'mono'],
        icon: '`',
        insert: makeInserter('``', -1),
    },
    {
        id: 'codeblock',
        label: 'Code Block',
        description: 'Fenced code block',
        keywords: ['codeblock', 'fence', 'pre'],
        icon: '{}',
        insert: makeInserter('```\n\n```', -4),
    },
    {
        id: 'quote',
        label: 'Quote',
        description: 'Block quote',
        keywords: ['quote', 'blockquote', 'bq'],
        icon: '❝',
        insert: makeInserter('> '),
    },
    {
        id: 'checklist',
        label: 'To-do',
        description: 'Checkbox task item',
        keywords: ['todo', 'checklist', 'task', 'checkbox'],
        icon: '☐',
        insert: makeInserter('- [ ] '),
    },
    {
        id: 'list',
        label: 'Bulleted List',
        description: 'Unordered list item',
        keywords: ['list', 'ul', 'bullet', 'item'],
        icon: '•',
        insert: makeInserter('- '),
    },
    {
        id: 'ordered',
        label: 'Numbered List',
        description: 'Ordered list item',
        keywords: ['ordered', 'ol', 'numbered', 'number'],
        icon: '1.',
        insert: makeInserter('1. '),
    },
    {
        id: 'divider',
        label: 'Divider',
        description: 'Horizontal rule',
        keywords: ['divider', 'hr', 'rule', 'separator'],
        icon: '—',
        insert: makeInserter('\n---\n'),
    },
    {
        id: 'link',
        label: 'Link',
        description: 'Hyperlink',
        keywords: ['link', 'url', 'href', 'a'],
        icon: '🔗',
        insert: makeInserter('[](url)', -4),
    },
    {
        id: 'wikilink',
        label: 'Note Link',
        description: 'Link to another note',
        keywords: ['wikilink', 'notelink', 'note', 'wiki', 'internal'],
        icon: '[[]]',
        insert: makeInserter('[[]]', -2),
    },
    {
        id: 'callout-note',
        label: 'Callout: Note',
        description: 'Informational callout',
        keywords: ['callout', 'note', 'info'],
        icon: 'ℹ',
        insert: makeInserter('> [!NOTE]\n> '),
    },
    {
        id: 'callout-tip',
        label: 'Callout: Tip',
        description: 'Tip callout',
        keywords: ['callout', 'tip'],
        icon: '💡',
        insert: makeInserter('> [!TIP]\n> '),
    },
    {
        id: 'callout-warning',
        label: 'Callout: Warning',
        description: 'Warning callout',
        keywords: ['callout', 'warning', 'warn'],
        icon: '⚠',
        insert: makeInserter('> [!WARNING]\n> '),
    },
    {
        id: 'callout-important',
        label: 'Callout: Important',
        description: 'Important callout',
        keywords: ['callout', 'important'],
        icon: '❗',
        insert: makeInserter('> [!IMPORTANT]\n> '),
    },
    {
        id: 'callout-danger',
        label: 'Callout: Danger',
        description: 'Danger callout',
        keywords: ['callout', 'danger', 'error'],
        icon: '🚨',
        insert: makeInserter('> [!DANGER]\n> '),
    },
];

function filterCommands(filter: string): SlashCommand[] {
    if (!filter) return SLASH_COMMANDS;
    const q = filter.toLowerCase();
    return SLASH_COMMANDS.filter(
        (cmd) =>
            cmd.label.toLowerCase().includes(q) ||
            cmd.keywords.some((k) => k.includes(q))
    );
}

interface SlashCommandMenuProps {
    x: number;
    y: number;
    filter: string;
    slashFrom: number;
    slashTo: number;
    view: EditorView;
    onClose: () => void;
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
    x,
    y,
    filter,
    slashFrom,
    slashTo,
    view,
    onClose,
}) => {
    const commands = filterCommands(filter);
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLButtonElement | null>(null);

    // Clamp activeIndex when filtered list shrinks
    const clampedIndex = Math.min(activeIndex, Math.max(0, commands.length - 1));

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
            if (commands.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % commands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + commands.length) % commands.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const cmd = commands[clampedIndex];
                if (cmd) {
                    cmd.insert(view, slashFrom, slashTo);
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [commands, clampedIndex, view, slashFrom, slashTo, onClose]);

    if (commands.length === 0) return null;

    // Position: prefer below cursor, flip up if near bottom
    const MENU_HEIGHT = Math.min(commands.length, 8) * 44;
    const spaceBelow = window.innerHeight - y;
    const top = spaceBelow > MENU_HEIGHT + 16 ? y + 4 : y - MENU_HEIGHT - 4;

    return ReactDOM.createPortal(
        <div
            ref={listRef}
            className="fixed z-[300] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-y-auto"
            style={{ left: x, top, minWidth: 220, maxWidth: 320, maxHeight: 352 }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {commands.map((cmd, i) => (
                <button
                    key={cmd.id}
                    ref={i === clampedIndex ? activeItemRef : null}
                    type="button"
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        i === clampedIndex
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        cmd.insert(view, slashFrom, slashTo);
                        onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                >
                    <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {cmd.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-tight">
                            {cmd.label}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 leading-tight">
                            {cmd.description}
                        </span>
                    </span>
                </button>
            ))}
        </div>,
        document.body
    );
};

export default SlashCommandMenu;
