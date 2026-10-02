import { Compartment, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Elements that act on a tap themselves instead of starting an edit.
const TAP_TARGETS =
    '[data-href], [data-wikilink], .cm-md-checkbox, .cm-md-code-copy';

export const isTouchScreen = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// On touch screens a note opens for reading: the content is not editable,
// so a long-press selects text and brings up the native Copy menu instead
// of placing a caret and opening the keyboard. A plain tap starts editing
// at that spot, and leaving the editor goes back to reading (#1767).
export const touchReading = (
    enabled: boolean,
    { startEditing = false }: { startEditing?: boolean } = {}
): Extension => {
    if (!enabled) return [];
    const mode = new Compartment();
    const editable = (on: boolean) => EditorView.editable.of(on);

    return [
        mode.of(editable(startEditing)),
        EditorView.focusChangeEffect.of((state, focusing) =>
            !focusing && state.facet(EditorView.editable)
                ? mode.reconfigure(editable(false))
                : null
        ),
        EditorView.domEventHandlers({
            click(event, view) {
                if (view.state.facet(EditorView.editable)) return false;
                const target = event.target as HTMLElement | null;
                if (target?.closest?.(TAP_TARGETS)) return false;
                if (!view.state.selection.main.empty) return false;
                const native = document.getSelection();
                if (native && !native.isCollapsed) return false;

                const pos =
                    view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                    view.state.selection.main.head;
                view.dispatch({
                    effects: mode.reconfigure(editable(true)),
                    selection: { anchor: pos },
                });
                view.focus();
                return true;
            },
        }),
    ];
};
