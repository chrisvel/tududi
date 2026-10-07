import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { blockHandlePlugin, blockHandleTheme } from '../blockHandle';

// jsdom does no real text layout, so posAtCoords/coordsAtPos always return
// meaningless (usually zeroed) values. To exercise the actual mousedown ->
// mousemove -> mouseup drag sequence, these are replaced with simple
// deterministic stand-ins: each block occupies a distinct 20px-tall row.
function mockLayout(view: EditorView, rows: { from: number; to: number }[]) {
    const rowsWithGeometry = rows.map((r, i) => ({
        ...r,
        top: i * 20,
        bottom: i * 20 + 20,
    }));
    view.posAtCoords = ((coords: { x: number; y: number }) => {
        const row = rowsWithGeometry.find(
            (r) => coords.y >= r.top && coords.y < r.bottom
        );
        return row ? row.from : null;
    }) as EditorView['posAtCoords'];
    view.coordsAtPos = ((pos: number) => {
        const row = rowsWithGeometry.find((r) => pos >= r.from && pos <= r.to);
        if (!row) return null;
        return { top: row.top, bottom: row.bottom, left: 0, right: 100 };
    }) as EditorView['coordsAtPos'];
    return rowsWithGeometry;
}

function mount(doc: string) {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc,
            extensions: [
                markdown({ base: markdownLanguage }),
                blockHandlePlugin,
                blockHandleTheme,
            ],
        }),
    });
    const plugin = view.plugin(blockHandlePlugin);
    if (!plugin) throw new Error('plugin not attached');
    return { parent, view, plugin };
}

function fireMouse(
    target: EventTarget,
    type: string,
    opts: Partial<MouseEventInit> = {}
) {
    target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, ...opts })
    );
}

describe('block handle drag (manual mouse events, not native DnD)', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
                matches: true,
                media: query,
                addListener: () => {},
                removeListener: () => {},
            }),
        });
    });

    it('reorders two paragraphs by dragging the handle down past the drag threshold', () => {
        const { parent, view } = mount('A\n\nB');
        const rows = mockLayout(view, [
            { from: 0, to: 1 }, // "A"
            { from: 3, to: 4 }, // "B"
        ]);

        // Hover over "A" so the handle attaches to it.
        fireMouse(view.dom, 'mousemove', {
            clientX: 5,
            clientY: rows[0].top + 5,
        });

        const handle = parent.querySelector(
            '.cm-block-handle-drag'
        ) as HTMLButtonElement;
        expect(handle.style.display).toBe('flex');

        fireMouse(handle, 'mousedown', {
            clientX: 5,
            clientY: rows[0].top + 5,
        });
        // Below the drag threshold: should not have started dragging yet.
        fireMouse(document, 'mousemove', {
            clientX: 5,
            clientY: rows[0].top + 6,
        });
        expect(view.state.doc.toString()).toBe('A\n\nB');

        // Past the threshold, over "B": drop-line should appear.
        fireMouse(document, 'mousemove', {
            clientX: 5,
            clientY: rows[1].top + 15,
        });
        const dropLine = parent.querySelector(
            '.cm-block-handle-dropline'
        ) as HTMLElement;
        expect(dropLine.style.display).toBe('block');

        fireMouse(document, 'mouseup', {
            clientX: 5,
            clientY: rows[1].top + 15,
        });

        expect(view.state.doc.toString()).toBe('B\n\nA');

        view.destroy();
        parent.remove();
    });

    it('does not reorder when the mouse never moves past the drag threshold (a plain click)', () => {
        const { parent, view } = mount('A\n\nB');
        mockLayout(view, [
            { from: 0, to: 1 },
            { from: 3, to: 4 },
        ]);

        fireMouse(view.dom, 'mousemove', { clientX: 5, clientY: 5 });
        const handle = parent.querySelector(
            '.cm-block-handle-drag'
        ) as HTMLButtonElement;

        fireMouse(handle, 'mousedown', { clientX: 5, clientY: 5 });
        fireMouse(document, 'mouseup', { clientX: 5, clientY: 5 });

        expect(view.state.doc.toString()).toBe('A\n\nB');

        view.destroy();
        parent.remove();
    });

    it('opens the turn-into menu on a plain click instead of dragging', () => {
        const { parent, view } = mount('A\n\nB');
        mockLayout(view, [
            { from: 0, to: 1 },
            { from: 3, to: 4 },
        ]);

        fireMouse(view.dom, 'mousemove', { clientX: 5, clientY: 5 });
        const handle = parent.querySelector(
            '.cm-block-handle-drag'
        ) as HTMLButtonElement;

        fireMouse(handle, 'mousedown', { clientX: 5, clientY: 5 });
        fireMouse(handle, 'mouseup', { clientX: 5, clientY: 5 });
        fireMouse(handle, 'click', { clientX: 5, clientY: 5 });

        expect(parent.querySelector('.cm-block-handle-menu')).not.toBeNull();

        view.destroy();
        parent.remove();
    });

    it('drops before/after based on which half of the target block the cursor is over', () => {
        const { parent, view } = mount('A\n\nB\n\nC');
        const rows = mockLayout(view, [
            { from: 0, to: 1 }, // "A"
            { from: 3, to: 4 }, // "B"
            { from: 6, to: 7 }, // "C"
        ]);

        // Drag A onto the *lower* half of C - should land after C.
        fireMouse(view.dom, 'mousemove', {
            clientX: 5,
            clientY: rows[0].top + 5,
        });
        const handle = parent.querySelector(
            '.cm-block-handle-drag'
        ) as HTMLButtonElement;
        fireMouse(handle, 'mousedown', {
            clientX: 5,
            clientY: rows[0].top + 5,
        });
        fireMouse(document, 'mousemove', {
            clientX: 5,
            clientY: rows[2].bottom - 2,
        });
        fireMouse(document, 'mouseup', {
            clientX: 5,
            clientY: rows[2].bottom - 2,
        });

        expect(view.state.doc.toString()).toBe('B\n\nC\n\nA');

        view.destroy();
        parent.remove();
    });
});
