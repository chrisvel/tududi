import { EditorView, KeyBinding } from '@codemirror/view';
import { wrapSelection, setHeading, insertLink } from './textCommands';
import { moveBlock, duplicateBlock } from './blocks';

function wrap(prefix: string, suffix = prefix) {
    return (view: EditorView): boolean => {
        wrapSelection(view, prefix, suffix);
        return true;
    };
}

function heading(level: number) {
    return (view: EditorView): boolean => {
        setHeading(view, level);
        return true;
    };
}

function link(view: EditorView): boolean {
    insertLink(view);
    return true;
}

function move(dir: 1 | -1) {
    return (view: EditorView): boolean => {
        const spec = moveBlock(view.state, view.state.selection.main.head, dir);
        if (!spec) return false;
        view.dispatch(spec);
        return true;
    };
}

function duplicate(view: EditorView): boolean {
    const spec = duplicateBlock(view.state, view.state.selection.main.head);
    if (!spec) return false;
    view.dispatch(spec);
    return true;
}

const LIST_LINE = /^(\s*)([-*+]|\d+[.)])\s/;
const INDENT_UNIT = '  ';

// Tab/Shift-Tab only indent or outdent a list line. Anywhere else they
// return false so the browser's own Tab behaviour (move focus) applies -
// Tab must never trap focus inside the editor.
function indentList(view: EditorView, dir: 1 | -1): boolean {
    const { state } = view;
    const { main } = state.selection;
    if (!main.empty) return false;

    const line = state.doc.lineAt(main.head);
    const match = line.text.match(LIST_LINE);
    if (!match) return false;

    if (dir === 1) {
        view.dispatch({
            changes: { from: line.from, to: line.from, insert: INDENT_UNIT },
        });
    } else {
        const indent = match[1];
        if (indent.length === 0) return false;
        const remove = Math.min(INDENT_UNIT.length, indent.length);
        view.dispatch({
            changes: { from: line.from, to: line.from + remove, insert: '' },
        });
    }
    return true;
}

export const blockUxKeymap: KeyBinding[] = [
    { key: 'Mod-b', run: wrap('**') },
    { key: 'Mod-i', run: wrap('_') },
    { key: 'Mod-Shift-x', run: wrap('~~') },
    { key: 'Mod-e', run: wrap('`') },
    { key: 'Mod-k', run: link },
    { key: 'Mod-1', run: heading(1) },
    { key: 'Mod-2', run: heading(2) },
    { key: 'Mod-3', run: heading(3) },
    { key: 'Alt-ArrowUp', run: move(-1) },
    { key: 'Alt-ArrowDown', run: move(1) },
    { key: 'Mod-Shift-d', run: duplicate },
    { key: 'Tab', run: (view) => indentList(view, 1) },
    { key: 'Shift-Tab', run: (view) => indentList(view, -1) },
];
