import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { EditorView, WidgetType } from '@codemirror/view';
import MermaidDiagram from '../../Shared/MermaidDiagram';
import { CALLOUT_CONFIG, CalloutType } from '../../Shared/CalloutBlock';
import { isSafeImageUrl, renderInline } from './inlineMarkdown';

const isEditable = (view: EditorView): boolean =>
    !view.state.readOnly && view.state.facet(EditorView.editable);

// Clicking a rendered block puts the caret at its start, which reveals the
// Markdown source (the block widget is only shown while the selection is
// outside the block).
const revealSourceOnMouseDown = (dom: HTMLElement, view: EditorView) => {
    dom.addEventListener('mousedown', (event) => {
        event.preventDefault();
        view.dispatch({
            selection: { anchor: view.posAtDOM(dom) },
            scrollIntoView: true,
        });
        view.focus();
    });
};

export class HRWidget extends WidgetType {
    toDOM(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'cm-md-hr';
        return el;
    }
    eq(): boolean {
        return true;
    }
    ignoreEvent(): boolean {
        return true;
    }
}

export class BulletWidget extends WidgetType {
    toDOM(): HTMLElement {
        const el = document.createElement('span');
        el.className = 'cm-md-bullet';
        el.textContent = '•';
        return el;
    }
    eq(): boolean {
        return true;
    }
}

export class CheckboxWidget extends WidgetType {
    constructor(readonly checked: boolean) {
        super();
    }

    eq(other: CheckboxWidget): boolean {
        return other.checked === this.checked;
    }

    toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-md-checkbox';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.checked;
        wrap.append(input);
        wrap.addEventListener('mousedown', (event) => {
            event.preventDefault();
            if (!isEditable(view)) return;
            // The widget replaces "[ ]" / "[x]", so the state character is
            // the one right after the widget start.
            const pos = view.posAtDOM(wrap) + 1;
            view.dispatch({
                changes: {
                    from: pos,
                    to: pos + 1,
                    insert: this.checked ? ' ' : 'x',
                },
            });
        });
        return wrap;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

export class CalloutTitleWidget extends WidgetType {
    constructor(
        readonly type: CalloutType,
        readonly title: string
    ) {
        super();
    }

    eq(other: CalloutTitleWidget): boolean {
        return other.type === this.type && other.title === this.title;
    }

    toDOM(): HTMLElement {
        const config = CALLOUT_CONFIG[this.type] ?? CALLOUT_CONFIG.NOTE;
        const el = document.createElement('span');
        el.className = 'cm-md-callout-label';
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = config.icon;
        const label = document.createElement('span');
        label.textContent = this.title || config.defaultLabel;
        el.append(icon, label);
        return el;
    }
}

export class CodeLangWidget extends WidgetType {
    constructor(readonly label: string) {
        super();
    }

    eq(other: CodeLangWidget): boolean {
        return other.label === this.label;
    }

    toDOM(): HTMLElement {
        const el = document.createElement('span');
        el.className = 'cm-md-code-lang';
        el.textContent = this.label;
        return el;
    }
}

export class ImageWidget extends WidgetType {
    constructor(
        readonly url: string,
        readonly alt: string
    ) {
        super();
    }

    eq(other: ImageWidget): boolean {
        return other.url === this.url && other.alt === this.alt;
    }

    toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement('span');
        wrap.className = 'cm-md-image';
        if (!isSafeImageUrl(this.url)) {
            wrap.textContent = this.alt;
            return wrap;
        }
        const img = document.createElement('img');
        img.src = this.url;
        img.alt = this.alt;
        img.loading = 'lazy';
        img.addEventListener('load', () => view.requestMeasure());
        img.addEventListener('error', () => {
            wrap.classList.add('cm-md-image-broken');
            wrap.textContent = this.alt || this.url;
            view.requestMeasure();
        });
        wrap.append(img);
        wrap.addEventListener('mousedown', (event) => {
            event.preventDefault();
            view.dispatch({
                selection: { anchor: view.posAtDOM(wrap) },
            });
            view.focus();
        });
        return wrap;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

export interface TableData {
    header: string[];
    align: Array<'left' | 'center' | 'right' | null>;
    rows: string[][];
}

export class TableWidget extends WidgetType {
    constructor(
        readonly data: TableData,
        readonly key: string
    ) {
        super();
    }

    eq(other: TableWidget): boolean {
        return other.key === this.key;
    }

    get estimatedHeight(): number {
        return (this.data.rows.length + 1) * 34 + 16;
    }

    toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-md-table-wrap';
        const table = document.createElement('table');
        table.className = 'cm-md-table';

        const fill = (
            cells: string[],
            tag: 'th' | 'td',
            parent: HTMLElement
        ) => {
            const tr = document.createElement('tr');
            this.data.header.forEach((_, i) => {
                const cell = document.createElement(tag);
                cell.append(renderInline(cells[i] ?? ''));
                const align = this.data.align[i];
                if (align) cell.style.textAlign = align;
                tr.append(cell);
            });
            parent.append(tr);
        };

        const thead = document.createElement('thead');
        fill(this.data.header, 'th', thead);
        const tbody = document.createElement('tbody');
        this.data.rows.forEach((row) => fill(row, 'td', tbody));
        table.append(thead, tbody);
        wrap.append(table);
        revealSourceOnMouseDown(wrap, view);
        return wrap;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

const mermaidRoots = new WeakMap<HTMLElement, Root>();

export class MermaidWidget extends WidgetType {
    constructor(readonly code: string) {
        super();
    }

    eq(other: MermaidWidget): boolean {
        return other.code === this.code;
    }

    get estimatedHeight(): number {
        return 240;
    }

    toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-md-mermaid';
        const root = createRoot(wrap);
        mermaidRoots.set(wrap, root);
        root.render(<MermaidDiagram code={this.code} />);
        revealSourceOnMouseDown(wrap, view);
        return wrap;
    }

    destroy(dom: HTMLElement): void {
        const root = mermaidRoots.get(dom);
        mermaidRoots.delete(dom);
        // Unmounting synchronously can happen while React is rendering.
        if (root) queueMicrotask(() => root.unmount());
    }

    ignoreEvent(): boolean {
        return true;
    }
}
