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

    private onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    private onMouseLeave = () => {
        if (!this.dragSource) this.hide();
    };
    private onDragOver = (e: DragEvent) => this.handleDragOver(e);
    private onDrop = (e: DragEvent) => this.handleDrop(e);
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

        this.handleBtn = document.createElement('button');
        this.handleBtn.type = 'button';
        this.handleBtn.className = 'cm-block-handle-btn cm-block-handle-drag';
        this.handleBtn.textContent = '⋮⋮';
        this.handleBtn.title = 'Drag to move, click for more actions';
        this.handleBtn.draggable = true;
        // No mousedown preventDefault here: calling it on a draggable
        // element stops the browser's own drag-and-drop from ever starting
        // (it uses mousedown to detect the drag gesture). The button lives
        // outside .cm-content, so clicking it doesn't move the editor's
        // caret anyway - there's nothing to guard against.
        this.handleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        this.handleBtn.addEventListener('dragstart', (e) =>
            this.handleDragStart(e)
        );
        this.handleBtn.addEventListener('dragend', () => this.handleDragEnd());

        this.dropLine = document.createElement('div');
        this.dropLine.className = 'cm-block-handle-dropline';

        this.layer.append(this.handleBtn, this.dropLine);
        if (SHOW_PLUS_BUTTON) this.layer.append(this.plusBtn);
        this.hide();

        if (this.enabled) {
            view.dom.append(this.layer);
            view.dom.addEventListener('mousemove', this.onMouseMove);
            view.dom.addEventListener('mouseleave', this.onMouseLeave);
            view.dom.addEventListener('dragover', this.onDragOver);
            view.dom.addEventListener('drop', this.onDrop);
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
        this.view.dom.removeEventListener('dragover', this.onDragOver);
        this.view.dom.removeEventListener('drop', this.onDrop);
        document.removeEventListener('mousedown', this.onDocClick);
        this.closeMenu();
        this.layer.remove();
    }

    private hide() {
        this.hovered = null;
        if (SHOW_PLUS_BUTTON) this.plusBtn.style.display = 'none';
        this.handleBtn.style.display = 'none';
    }

    private handleMouseMove(e: MouseEvent) {
        if (this.dragSource) return;
        // Moving onto our own overlay (the handle button, the menu) must not
        // recompute which block is "hovered" - it should stay exactly what
        // it was when the button was positioned, otherwise a mousemove that
        // lands slightly outside the text (still within .cm-content's own
        // padding) right as a drag gesture starts could null it out from
        // under handleDragStart.
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

    private handleDragStart(e: DragEvent) {
        if (!this.hovered) {
            e.preventDefault();
            return;
        }
        this.dragSource = this.hovered;
        e.dataTransfer?.setData('text/plain', 'block');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        this.closeMenu();
    }

    private handleDragEnd() {
        this.dragSource = null;
        this.dropTarget = null;
        this.dropLine.style.display = 'none';
    }

    private handleDragOver(e: DragEvent) {
        if (!this.dragSource) return;
        e.preventDefault();
        const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos == null) return;
        const block = blockAt(this.view.state, pos);
        if (!block || sameBlock(block, this.dragSource)) {
            this.dropLine.style.display = 'none';
            this.dropTarget = null;
            return;
        }

        const top = this.view.coordsAtPos(block.from);
        const bottom = this.view.coordsAtPos(block.to);
        if (!top || !bottom) return;
        const midpoint = (top.top + bottom.bottom) / 2;
        const before = e.clientY < midpoint;
        this.dropTarget = { block, before };

        const editorBox = this.view.dom.getBoundingClientRect();
        const lineY = (before ? top.top : bottom.bottom) - editorBox.top;
        this.dropLine.style.display = 'block';
        this.dropLine.style.top = `${lineY}px`;
    }

    private handleDrop(e: DragEvent) {
        if (!this.dragSource || !this.dropTarget) return;
        e.preventDefault();
        const spec = reorderBlock(
            this.view.state,
            this.dragSource.from,
            this.dropTarget.block.from,
            this.dropTarget.before
        );
        if (spec) this.view.dispatch(spec);
        this.handleDragEnd();
        this.hide();
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
