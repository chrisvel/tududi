import { EditorView } from '@codemirror/view';

export function wrapSelection(
    view: EditorView,
    prefix: string,
    suffix: string = prefix
) {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    if (
        selected.startsWith(prefix) &&
        selected.endsWith(suffix) &&
        selected.length > prefix.length + suffix.length
    ) {
        view.dispatch({
            changes: {
                from,
                to,
                insert: selected.slice(
                    prefix.length,
                    selected.length - suffix.length
                ),
            },
            selection: {
                anchor: from,
                head: to - prefix.length - suffix.length,
            },
        });
    } else {
        view.dispatch({
            changes: { from, to, insert: `${prefix}${selected}${suffix}` },
            selection: {
                anchor: from,
                head: to + prefix.length + suffix.length,
            },
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
            changes: {
                from: line.from,
                to: line.from + existing[0].length,
                insert: prefix,
            },
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
