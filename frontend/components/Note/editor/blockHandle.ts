import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import {
    Block,
    BlockKind,
    blockAt,
    deleteBlock,
    duplicateBlock,
    insertBlockBelow,
    moveBlock,
    reorderBlock,
    turnInto,
} from './blocks';

const TURN_INTO_OPTIONS: { kind: BlockKind; label: string }[] = [
    { kind: 'paragraph', label: 'Text' },
    { kind: 'h1', label: 'Heading 1' },
    { kind: 'h2', label: 'Heading 2' },
    { kind: 'h3', label: 'Heading 3' },
    { kind: 'bullet', label: 'Bulleted list' },
    { kind: 'ordered', label: 'Numbered list' },
    { kind: 'todo', label: 'To-do' },
    { kind: 'quote', label: 'Quote' },
    { kind: 'code', label: 'Code' },
    { kind: 'callout', label: 'Callout' },
];

const canHover = (): boolean =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false;

// The "+" insert-below button is disabled for now (kept in place so it's a
// one-line flip to bring back) - only the drag handle shows.
const SHOW_PLUS_BUTTON = false;

// Must match the width/height in blockHandleTheme's `.cm-block-handle-btn`.
const BUTTON_SIZE = 20;

// Pixels of mouse movement before a mousedown-on-handle counts as a drag
// rather than a click.
const DRAG_THRESHOLD = 4;

class BlockHandlePlugin {
    layer: HTMLDivElement;
    plusBtn: HTMLButtonElement;
    handleBtn: HTMLButtonElement;
    dropLine: HTMLDivElement;
    menu: HTMLDivElement | null = null;

    hovered: Block | null = null;
    dragSource: Block | null = null;
    dropTarget: { block: Block; before: boolean } | null = null;
    enabled = canHover();

    private dragStartPos: { x: number; y: number } | null = null;
    // True once a mousedown-on-handle has moved past DRAG_THRESHOLD. The
    // click event that follows mouseup is suppressed for that one gesture so
    // a completed drag doesn't also pop the menu open.
    private didDrag = false;

    private onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    private onMouseLeave = () => {
        if (!this.dragSource) this.hide();
    };
    private onHandleMouseDown = (e: MouseEvent) => this.startDrag(e);
    private onDragMove = (e: MouseEvent) => this.continueDrag(e);
    private onDragUp = (e: MouseEvent) => this.finishDrag(e);
    private onDocClick = (e: MouseEvent) => {
        if (this.menu && !this.menu.contains(e.target as Node)) {
            this.closeMenu();
        }
    };

    constructor(readonly view: EditorView) {
        if (getComputedStyle(view.dom).position === 'static') {
            view.dom.style.position = 'relative';
        }

        this.layer = document.createElement('div');
        this.layer.className = 'cm-block-handle-layer';

        this.plusBtn = document.createElement('button');
        this.plusBtn.type = 'button';
        this.plusBtn.className = 'cm-block-handle-btn cm-block-handle-plus';
        this.plusBtn.textContent = '+';
        this.plusBtn.title = 'Insert below';
        this.plusBtn.addEventListener('mousedown', (e) => e.preventDefault());
        this.plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.insertBelow();
        });

        // Dragging is implemented by hand with mousedown/mousemove/mouseup
        // rather than native HTML5 drag-and-drop (`draggable`/dragstart/
        // dragover/drop). Native DnD turned out unreliable here: it
        // interacts unpredictably with CodeMirror's own event handling
        // (its built-in drop-to-insert-text behaviour fired before this
        // plugin's own drop handler got a chance to run), and the
        // mousedown-to-dragstart handoff is finicky across browsers.
        // Notion, Linear and most other block editors implement block
        // dragging the same manual way for the same reasons.
        this.handleBtn = document.createElement('button');
        this.handleBtn.type = 'button';
        this.handleBtn.className = 'cm-block-handle-btn cm-block-handle-drag';
        this.handleBtn.textContent = '⋮⋮';
        this.handleBtn.title = 'Drag to move, click for more actions';
        this.handleBtn.addEventListener('mousedown', this.onHandleMouseDown);
        this.handleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.didDrag) {
                this.didDrag = false;
                return;
            }
            this.toggleMenu();
        });

        this.dropLine = document.createElement('div');
        this.dropLine.className = 'cm-block-handle-dropline';

        this.layer.append(this.handleBtn, this.dropLine);
        if (SHOW_PLUS_BUTTON) this.layer.append(this.plusBtn);
        this.hide();

        if (this.enabled) {
            view.dom.append(this.layer);
            view.dom.addEventListener('mousemove', this.onMouseMove);
            view.dom.addEventListener('mouseleave', this.onMouseLeave);
            document.addEventListener('mousedown', this.onDocClick);
        }
    }

    update(update: ViewUpdate) {
        if (!this.enabled) return;
        if (update.docChanged || update.viewportChanged) {
            this.closeMenu();
            this.hide();
        }
    }

    destroy() {
        this.view.dom.removeEventListener('mousemove', this.onMouseMove);
        this.view.dom.removeEventListener('mouseleave', this.onMouseLeave);
        document.removeEventListener('mousedown', this.onDocClick);
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragUp);
        if (this.didDrag) document.body.style.cursor = '';
        this.closeMenu();
        this.layer.remove();
    }

    private hide() {
        this.hovered = null;
        if (SHOW_PLUS_BUTTON) this.plusBtn.style.display = 'none';
        this.handleBtn.style.display = 'none';
    }

    private handleMouseMove(e: MouseEvent) {
        // While a drag is in progress, dropTarget tracking (continueDrag,
        // driven by its own document-level listener) owns the mouse -
        // this hover logic must not reposition the handle out from under
        // an active drag.
        if (this.dragSource) return;
        // Moving onto our own overlay (the handle button, the menu) must not
        // recompute which block is "hovered" - it should stay exactly what
        // it was when the button was positioned.
        if (e.target instanceof Node && this.layer.contains(e.target)) return;
        const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos == null) {
            this.hide();
            return;
        }
        const block = blockAt(this.view.state, pos);
        if (!block) {
            this.hide();
            return;
        }
        if (this.hovered && sameBlock(this.hovered, block)) return;
        this.hovered = block;
        this.position(block);
    }

    private position(block: Block) {
        const coords = this.view.coordsAtPos(block.from);
        if (!coords) {
            this.hide();
            return;
        }
        const editorBox = this.view.dom.getBoundingClientRect();
        // Center the (fixed-height) button on the line's own box rather than
        // pinning it to the line's top edge, so it doesn't sit visually high
        // against taller lines (headings) or short ones.
        const lineHeight = coords.bottom - coords.top;
        const top = coords.top - editorBox.top + (lineHeight - BUTTON_SIZE) / 2;
        this.handleBtn.style.display = 'flex';
        this.handleBtn.style.top = `${top}px`;
        if (SHOW_PLUS_BUTTON) {
            this.plusBtn.style.display = 'flex';
            this.plusBtn.style.top = `${top}px`;
        }
    }

    private insertBelow() {
        if (!this.hovered) return;
        const spec = insertBlockBelow(this.view.state, this.hovered.from);
        if (spec) this.view.dispatch(spec);
        this.view.focus();
        this.hide();
    }

    private toggleMenu() {
        if (this.menu) {
            this.closeMenu();
            return;
        }
        this.openMenu();
    }

    private closeMenu() {
        this.menu?.remove();
        this.menu = null;
    }

    private openMenu() {
        if (!this.hovered) return;
        const block = this.hovered;
        const menu = document.createElement('div');
        menu.className = 'cm-block-handle-menu';

        const addItem = (label: string, onClick: () => void) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'cm-block-handle-menu-item';
            item.textContent = label;
            item.addEventListener('mousedown', (e) => e.preventDefault());
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
                this.closeMenu();
                this.view.focus();
            });
            menu.append(item);
        };

        const addSeparator = () => {
            const sep = document.createElement('div');
            sep.className = 'cm-block-handle-menu-separator';
            menu.append(sep);
        };

        const turnIntoGroup = document.createElement('div');
        turnIntoGroup.className = 'cm-block-handle-menu-label';
        turnIntoGroup.textContent = 'Turn into';
        menu.append(turnIntoGroup);

        for (const option of TURN_INTO_OPTIONS) {
            if (option.kind === block.kind) continue;
            addItem(option.label, () => {
                const spec = turnInto(this.view.state, block.from, option.kind);
                if (spec) this.view.dispatch(spec);
            });
        }

        addSeparator();
        addItem('Duplicate', () => {
            const spec = duplicateBlock(this.view.state, block.from);
            if (spec) this.view.dispatch(spec);
        });
        addItem('Move up', () => {
            const spec = moveBlock(this.view.state, block.from, -1);
            if (spec) this.view.dispatch(spec);
        });
        addItem('Move down', () => {
            const spec = moveBlock(this.view.state, block.from, 1);
            if (spec) this.view.dispatch(spec);
        });
        addSeparator();
        addItem('Delete', () => {
            const spec = deleteBlock(this.view.state, block.from);
            if (spec) this.view.dispatch(spec);
        });

        const handleBox = this.handleBtn.getBoundingClientRect();
        const editorBox = this.view.dom.getBoundingClientRect();
        menu.style.top = `${handleBox.bottom - editorBox.top + 4}px`;
        menu.style.left = `${handleBox.left - editorBox.left}px`;

        this.layer.append(menu);
        this.menu = menu;
    }

    private startDrag(e: MouseEvent) {
        if (e.button !== 0 || !this.hovered) return;
        // Safe to prevent here (unlike native drag-and-drop, nothing else
        // depends on this mousedown reaching the browser's default
        // handling), which stops it from also starting a text selection.
        e.preventDefault();
        this.dragSource = this.hovered;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.didDrag = false;
        this.closeMenu();
        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragUp);
    }

    private continueDrag(e: MouseEvent) {
        if (!this.dragSource) return;
        if (!this.didDrag && this.dragStartPos) {
            const dx = e.clientX - this.dragStartPos.x;
            const dy = e.clientY - this.dragStartPos.y;
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            this.didDrag = true;
            document.body.style.cursor = 'grabbing';
        }
        this.updateDropTarget(e.clientX, e.clientY);
    }

    private updateDropTarget(clientX: number, clientY: number) {
        if (!this.dragSource) return;

        let pos = this.view.posAtCoords({ x: clientX, y: clientY });
        if (pos == null) {
            // Dragged above or below all content - treat it as targeting the
            // very start or end of the document rather than giving up.
            const editorBox = this.view.dom.getBoundingClientRect();
            pos = clientY < editorBox.top ? 0 : this.view.state.doc.length;
        }

        let block = blockAt(this.view.state, pos);
        if (!block) {
            // The exact position landed in a blank-line gap between two
            // blocks rather than inside either one - the nearest block is
            // still a perfectly good drop target.
            block =
                blockAt(this.view.state, Math.max(0, pos - 1)) ??
                blockAt(
                    this.view.state,
                    Math.min(this.view.state.doc.length, pos + 1)
                );
        }

        if (!block || sameBlock(block, this.dragSource)) {
            this.dropLine.style.display = 'none';
            this.dropTarget = null;
            return;
        }

        const top = this.view.coordsAtPos(block.from);
        const bottom = this.view.coordsAtPos(block.to);
        if (!top || !bottom) return;
        const midpoint = (top.top + bottom.bottom) / 2;
        const before = clientY < midpoint;
        this.dropTarget = { block, before };

        const editorBox = this.view.dom.getBoundingClientRect();
        const lineY = (before ? top.top : bottom.bottom) - editorBox.top;
        this.dropLine.style.display = 'block';
        this.dropLine.style.top = `${lineY}px`;
    }

    private finishDrag(e: MouseEvent) {
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragUp);
        document.body.style.cursor = '';

        const wasDrag = this.didDrag;
        if (wasDrag && this.dragSource) {
            this.updateDropTarget(e.clientX, e.clientY);
            if (this.dropTarget) {
                const spec = reorderBlock(
                    this.view.state,
                    this.dragSource.from,
                    this.dropTarget.block.from,
                    this.dropTarget.before
                );
                if (spec) this.view.dispatch(spec);
            }
        }

        this.dragSource = null;
        this.dropTarget = null;
        this.dragStartPos = null;
        this.dropLine.style.display = 'none';
        // Only hide (which clears `hovered`) after an actual drag. For a
        // plain click, the 'click' event fires right after this and needs
        // `hovered` to still point at the block the handle was on, to open
        // its menu.
        if (wasDrag) this.hide();
    }
}

function sameBlock(a: Block, b: Block): boolean {
    return a.from === b.from && a.to === b.to;
}

export const blockHandlePlugin = ViewPlugin.fromClass(BlockHandlePlugin);

export const blockHandleTheme = EditorView.baseTheme({
    '.cm-block-handle-layer': {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '20',
    },
    '.cm-block-handle-btn': {
        position: 'absolute',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        pointerEvents: 'auto',
        fontSize: '13px',
        lineHeight: '1',
        padding: '0',
    },
    '&light .cm-block-handle-btn': {
        color: 'rgba(0,0,0,0.45)',
        background: 'transparent',
    },
    '&dark .cm-block-handle-btn': {
        color: 'rgba(255,255,255,0.45)',
        background: 'transparent',
    },
    '&light .cm-block-handle-btn:hover': { background: 'rgba(0,0,0,0.08)' },
    '&dark .cm-block-handle-btn:hover': {
        background: 'rgba(255,255,255,0.12)',
    },
    // Reserve a permanent left gutter inside the editor's own box for the
    // handle, rather than pushing it into negative space that depends on
    // whatever padding the embedding page happens to provide - MarkdownEditor
    // is used inside several different containers (Notes.tsx, NoteModal,
    // NoteFocusMode, task descriptions), and some of those don't leave
    // enough room, which silently hides it behind other UI.
    '.cm-content': { paddingLeft: '28px !important' },
    '.cm-block-handle-plus': { left: '2px' },
    '.cm-block-handle-drag': { left: '2px', cursor: 'grab' },
    '.cm-block-handle-dropline': {
        position: 'absolute',
        left: '0',
        right: '0',
        height: '2px',
        display: 'none',
        borderRadius: '1px',
        pointerEvents: 'none',
    },
    '&light .cm-block-handle-dropline': { background: '#2563eb' },
    '&dark .cm-block-handle-dropline': { background: '#60a5fa' },
    '.cm-block-handle-menu': {
        position: 'absolute',
        minWidth: '160px',
        maxHeight: '320px',
        overflowY: 'auto',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        pointerEvents: 'auto',
        padding: '4px',
        zIndex: '30',
    },
    '&light .cm-block-handle-menu': {
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.1)',
    },
    '&dark .cm-block-handle-menu': {
        background: '#1f2937',
        border: '1px solid rgba(255,255,255,0.1)',
    },
    '.cm-block-handle-menu-label': {
        fontSize: '11px',
        fontWeight: '600',
        opacity: '0.5',
        padding: '4px 8px',
        textTransform: 'uppercase',
    },
    '.cm-block-handle-menu-item': {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '13px',
    },
    '&light .cm-block-handle-menu-item': { color: '#111827' },
    '&dark .cm-block-handle-menu-item': { color: '#f3f4f6' },
    '&light .cm-block-handle-menu-item:hover': {
        background: 'rgba(0,0,0,0.06)',
    },
    '&dark .cm-block-handle-menu-item:hover': {
        background: 'rgba(255,255,255,0.1)',
    },
    '.cm-block-handle-menu-separator': {
        height: '1px',
        margin: '4px 0',
    },
    '&light .cm-block-handle-menu-separator': {
        background: 'rgba(0,0,0,0.08)',
    },
    '&dark .cm-block-handle-menu-separator': {
        background: 'rgba(255,255,255,0.1)',
    },
});
