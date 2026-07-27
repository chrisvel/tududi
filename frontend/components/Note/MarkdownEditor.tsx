import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EditorView, ViewUpdate, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import FormattingToolbar from './FormattingToolbar';
import SlashCommandMenu from './SlashCommandMenu';
import WikilinkMenu, { NoteTitle } from './WikilinkMenu';
import { livePreviewExtension } from './livePreviewExtension';
import { useStore } from '../../store/useStore';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    noteColor?: string;
    autoFocus?: boolean;
    className?: string;
    minHeight?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const shouldUseLightText = (hexColor: string | undefined): boolean => {
    if (!hexColor) return false;
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.4;
};

export function wrapSelection(view: EditorView, prefix: string, suffix: string = prefix) {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length > prefix.length + suffix.length) {
        view.dispatch({
            changes: { from, to, insert: selected.slice(prefix.length, selected.length - suffix.length) },
            selection: { anchor: from, head: to - prefix.length - suffix.length },
        });
    } else {
        view.dispatch({
            changes: { from, to, insert: `${prefix}${selected}${suffix}` },
            selection: { anchor: from, head: to + prefix.length + suffix.length },
        });
    }
    view.focus();
}

export function setHeading(view: EditorView, level: number) {
    const prefix = '#'.repeat(level) + ' ';
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const existing = line.text.match(/^(#{1,6})\s/);
    if (existing) {
        view.dispatch({
            changes: { from: line.from, to: line.from + existing[0].length, insert: prefix },
        });
    } else {
        view.dispatch({
            changes: { from: line.from, to: line.from, insert: prefix },
        });
    }
    view.focus();
}

export function insertLink(view: EditorView) {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const insertion = selected ? `[${selected}](url)` : '[link text](url)';
    view.dispatch({ changes: { from, to, insert: insertion } });
    view.focus();
}

const baseEditorTheme = EditorView.theme({
    '&': { fontSize: 'inherit' },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': {
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: '1.7',
        padding: '4px 0',
    },
    '.cm-line': { padding: '0 2px' },
    '.cm-scroller': { fontFamily: 'inherit', overflow: 'visible' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(59, 130, 246, 0.25) !important' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(59, 130, 246, 0.35) !important' },
    '.cm-cursor, .cm-dropCursor': { borderLeftWidth: '2px' },
});

interface SlashMenuState {
    open: boolean;
    x: number;
    y: number;
    filter: string;
    from: number;
    to: number;
}

interface WikilinkMenuState {
    open: boolean;
    x: number;
    y: number;
    filter: string;
    from: number;
    to: number;
}

const CLOSED_SLASH: SlashMenuState = { open: false, x: 0, y: 0, filter: '', from: 0, to: 0 };
const CLOSED_WIKI: WikilinkMenuState = { open: false, x: 0, y: 0, filter: '', from: 0, to: 0 };

function detectSlashTrigger(
    view: EditorView
): { from: number; to: number; filter: string; coords: { x: number; y: number } } | null {
    const { main } = view.state.selection;
    if (!main.empty) return null;

    const cursor = main.from;
    const line = view.state.doc.lineAt(cursor);
    const textToCursor = line.text.slice(0, cursor - line.from);

    // Match /command at start-of-line or after whitespace
    const m = textToCursor.match(/(?:^|(?<=\s))\/([a-z0-9-]*)$/i);
    if (!m) return null;

    const slashRelPos = textToCursor.length - 1 - m[1].length;
    const slashAbsPos = line.from + slashRelPos;
    const filter = m[1];

    const coords = view.coordsAtPos(cursor);
    if (!coords) return null;

    return { from: slashAbsPos, to: cursor, filter, coords: { x: coords.left, y: coords.top } };
}

function detectWikilinkTrigger(
    view: EditorView
): { from: number; to: number; filter: string; coords: { x: number; y: number } } | null {
    const { main } = view.state.selection;
    if (!main.empty) return null;

    const cursor = main.from;
    const line = view.state.doc.lineAt(cursor);
    const textToCursor = line.text.slice(0, cursor - line.from);

    // Match [[ possibly followed by partial title text (no ]] yet)
    const m = textToCursor.match(/\[\[([^[\]]*)$/);
    if (!m) return null;

    const openBracketRelPos = textToCursor.length - 2 - m[1].length;
    const openBracketAbsPos = line.from + openBracketRelPos;
    const filter = m[1];

    const coords = view.coordsAtPos(cursor);
    if (!coords) return null;

    return { from: openBracketAbsPos, to: cursor, filter, coords: { x: coords.left, y: coords.top } };
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    placeholder = 'Write your note here... (Markdown supported)',
    noteColor,
    autoFocus = false,
    className = '',
    minHeight = '300px',
    onClick,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Load notes from store for wikilink autocomplete
    const storeNotes = useStore((state) => state.notesStore.notes);
    const hasNotesLoaded = useStore((state) => state.notesStore.hasLoaded);
    const loadNotes = useStore((state) => state.notesStore.loadNotes);

    useEffect(() => {
        if (!hasNotesLoaded) loadNotes();
    }, [hasNotesLoaded, loadNotes]);

    const noteTitles: NoteTitle[] = useMemo(
        () => storeNotes.filter((n) => n.uid).map((n) => ({ uid: n.uid as string, title: n.title })),
        [storeNotes]
    );

    const [toolbarState, setToolbarState] = useState<{
        visible: boolean;
        x: number;
        y: number;
    }>({ visible: false, x: 0, y: 0 });

    const [slashMenu, setSlashMenu] = useState<SlashMenuState>(CLOSED_SLASH);
    const [wikilinkMenu, setWikilinkMenu] = useState<WikilinkMenuState>(CLOSED_WIKI);

    const slashMenuRef = useRef(slashMenu);
    slashMenuRef.current = slashMenu;
    const wikilinkMenuRef = useRef(wikilinkMenu);
    wikilinkMenuRef.current = wikilinkMenu;

    const lightText = shouldUseLightText(noteColor);
    const textColor = noteColor ? (lightText ? '#ffffff' : '#333333') : undefined;

    const closeSlash = useCallback(() => setSlashMenu(CLOSED_SLASH), []);
    const closeWikilink = useCallback(() => setWikilinkMenu(CLOSED_WIKI), []);

    useEffect(() => {
        if (!containerRef.current) return;

        const themeCompartment = new Compartment();

        const getThemeExtension = () => {
            const isDark = document.documentElement.classList.contains('dark');
            return isDark ? oneDark : syntaxHighlighting(defaultHighlightStyle);
        };

        const colorOverride = noteColor
            ? EditorView.theme({
                  '.cm-content': { color: textColor, caretColor: textColor },
                  '.cm-cursor, .cm-dropCursor': { borderLeftColor: textColor || 'auto' },
              })
            : [];

        const state = EditorState.create({
            doc: value,
            extensions: [
                markdown({ base: markdownLanguage }),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                EditorView.lineWrapping,
                cmPlaceholder(placeholder),
                baseEditorTheme,
                themeCompartment.of(getThemeExtension()),
                colorOverride,
                livePreviewExtension,
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString());
                    }

                    const view = update.view;

                    // Formatting toolbar (on selection)
                    const { main } = update.state.selection;
                    if (!main.empty) {
                        const fromCoords = view.coordsAtPos(main.from);
                        const toCoords = view.coordsAtPos(main.to);
                        if (fromCoords && toCoords) {
                            const midX = (fromCoords.left + toCoords.right) / 2;
                            const topY = Math.min(fromCoords.top, toCoords.top);
                            setToolbarState((prev) => {
                                if (prev.visible && Math.abs(prev.x - midX) < 1 && Math.abs(prev.y - topY) < 1) return prev;
                                return { visible: true, x: midX, y: topY };
                            });
                        }
                    } else {
                        setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
                    }

                    // Slash command trigger detection
                    const slashTrigger = detectSlashTrigger(view);
                    if (slashTrigger) {
                        setSlashMenu({
                            open: true,
                            x: slashTrigger.coords.x,
                            y: slashTrigger.coords.y,
                            filter: slashTrigger.filter,
                            from: slashTrigger.from,
                            to: slashTrigger.to,
                        });
                        setWikilinkMenu(CLOSED_WIKI);
                    } else {
                        if (slashMenuRef.current.open) setSlashMenu(CLOSED_SLASH);

                        // Wikilink trigger detection (only when slash not active)
                        const wikilinkTrigger = detectWikilinkTrigger(view);
                        if (wikilinkTrigger) {
                            setWikilinkMenu({
                                open: true,
                                x: wikilinkTrigger.coords.x,
                                y: wikilinkTrigger.coords.y,
                                filter: wikilinkTrigger.filter,
                                from: wikilinkTrigger.from,
                                to: wikilinkTrigger.to,
                            });
                        } else {
                            if (wikilinkMenuRef.current.open) setWikilinkMenu(CLOSED_WIKI);
                        }
                    }
                }),
            ],
        });

        const view = new EditorView({ state, parent: containerRef.current });
        viewRef.current = view;

        if (autoFocus) {
            setTimeout(() => view.focus(), 50);
        }

        const observer = new MutationObserver(() => {
            view.dispatch({ effects: themeCompartment.reconfigure(getThemeExtension()) });
        });
        observer.observe(document.documentElement, { attributeFilter: ['class'] });

        return () => {
            observer.disconnect();
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Intentionally empty: CodeMirror view is created once on mount; value/onChange synced via refs/separate effects

    // Sync external value changes (switching notes)
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current !== value) {
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: value ?? '' },
            });
        }
    }, [value]);

    const handleBold = useCallback(() => { if (viewRef.current) wrapSelection(viewRef.current, '**'); }, []);
    const handleItalic = useCallback(() => { if (viewRef.current) wrapSelection(viewRef.current, '_'); }, []);
    const handleStrikethrough = useCallback(() => { if (viewRef.current) wrapSelection(viewRef.current, '~~'); }, []);
    const handleCode = useCallback(() => { if (viewRef.current) wrapSelection(viewRef.current, '`'); }, []);
    const handleLink = useCallback(() => { if (viewRef.current) insertLink(viewRef.current); }, []);
    const handleHeading = useCallback((level: number) => { if (viewRef.current) setHeading(viewRef.current, level); }, []);

    return (
        <div
            className={`relative cm-editor-wrapper ${className}`}
            style={{ minHeight }}
            onClick={onClick}
        >
            <div ref={containerRef} className="w-full" />
            <FormattingToolbar
                visible={toolbarState.visible}
                x={toolbarState.x}
                y={toolbarState.y}
                onBold={handleBold}
                onItalic={handleItalic}
                onStrikethrough={handleStrikethrough}
                onCode={handleCode}
                onLink={handleLink}
                onHeading={handleHeading}
            />
            {slashMenu.open && viewRef.current && (
                <SlashCommandMenu
                    x={slashMenu.x}
                    y={slashMenu.y}
                    filter={slashMenu.filter}
                    slashFrom={slashMenu.from}
                    slashTo={slashMenu.to}
                    view={viewRef.current}
                    onClose={closeSlash}
                />
            )}
            {wikilinkMenu.open && viewRef.current && (
                <WikilinkMenu
                    x={wikilinkMenu.x}
                    y={wikilinkMenu.y}
                    filter={wikilinkMenu.filter}
                    triggerFrom={wikilinkMenu.from}
                    triggerTo={wikilinkMenu.to}
                    view={viewRef.current}
                    noteTitles={noteTitles}
                    onClose={closeWikilink}
                />
            )}
        </div>
    );
};

export default MarkdownEditor;
