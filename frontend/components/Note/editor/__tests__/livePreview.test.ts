import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { DecorationSet } from '@codemirror/view';
import { buildLivePreview } from '../livePreview';
import { buildBlockWidgets } from '../blockWidgets';
import { livePreviewExtension } from '../index';

interface Item {
    from: number;
    to: number;
    kind: string;
}

const flatten = (set: DecorationSet): Item[] => {
    const out: Item[] = [];
    const iter = set.iter();
    while (iter.value) {
        const spec: any = iter.value.spec;
        let kind: string;
        if (spec.widget) kind = spec.widget.constructor.name;
        else if (spec.class) kind = `mark:${spec.class}`;
        else if (spec.attributes) kind = `line:${spec.attributes.class ?? ''}`;
        else kind = 'hide';
        out.push({ from: iter.from, to: iter.to, kind });
        iter.next();
    }
    return out;
};

const stateFor = (doc: string, cursor = doc.length) =>
    EditorState.create({
        doc,
        selection: { anchor: cursor },
        extensions: [markdown({ base: markdownLanguage })],
    });

const inline = (doc: string, cursor?: number) => {
    const state = stateFor(doc, cursor);
    return flatten(
        buildLivePreview(state, [{ from: 0, to: state.doc.length }]).decorations
    );
};

const has = (items: Item[], kind: string, from?: number, to?: number) =>
    items.some(
        (i) =>
            i.kind === kind &&
            (from === undefined || i.from === from) &&
            (to === undefined || i.to === to)
    );

describe('live preview decorations', () => {
    it('styles headings and hides the marker when the caret is elsewhere', () => {
        const items = inline('# Title\ntail');
        expect(has(items, 'line:cm-md-h1', 0)).toBe(true);
        expect(has(items, 'hide', 0, 2)).toBe(true);
    });

    it('dims the heading marker while the caret is on the line', () => {
        const items = inline('# Title\ntail', 3);
        expect(has(items, 'line:cm-md-h1', 0)).toBe(true);
        expect(has(items, 'mark:cm-md-marker', 0, 2)).toBe(true);
        expect(has(items, 'hide', 0, 2)).toBe(false);
    });

    it('hides bold markers off-element and reveals them inside it', () => {
        const doc = 'a **bold** b\ntail';
        const away = inline(doc);
        expect(has(away, 'mark:cm-md-bold', 2, 10)).toBe(true);
        expect(has(away, 'hide', 2, 4)).toBe(true);
        expect(has(away, 'hide', 8, 10)).toBe(true);

        const inside = inline(doc, 5);
        expect(has(inside, 'hide', 2, 4)).toBe(false);
        expect(has(inside, 'mark:cm-md-marker', 2, 4)).toBe(true);
    });

    it('does not decorate Markdown inside a fenced code block', () => {
        const doc = '```js\nx **y** `z`\n```\ntail';
        const items = inline(doc);
        expect(items.some((i) => i.kind === 'mark:cm-md-bold')).toBe(false);
        expect(items.some((i) => i.kind === 'mark:cm-md-code')).toBe(false);
        expect(
            has(items, 'line:cm-md-codeblock cm-md-codeblock-first', 0)
        ).toBe(true);
        expect(has(items, 'CodeLangWidget', 0, 5)).toBe(true);
    });

    it('keeps the fence source visible while the caret is inside the block', () => {
        const items = inline('```js\nx\n```\ntail', 7);
        expect(items.some((i) => i.kind === 'CodeLangWidget')).toBe(false);
    });

    it('renders task markers as checkboxes and mutes completed items', () => {
        const items = inline('- [ ] open\n- [x] done\n\ntail');
        expect(has(items, 'CheckboxWidget', 2, 5)).toBe(true);
        expect(has(items, 'CheckboxWidget', 13, 16)).toBe(true);
        expect(has(items, 'mark:cm-md-task-done')).toBe(true);
        expect(
            items.filter((i) => i.kind === 'mark:cm-md-task-done')
        ).toHaveLength(1);
    });

    it('replaces bullet markers with a bullet glyph', () => {
        const items = inline('- item\n\ntail');
        expect(has(items, 'BulletWidget', 0, 2)).toBe(true);
    });

    it('detects callouts and swaps the marker for a title widget', () => {
        const doc = '> [!WARNING] Careful\n> body\n\ntail';
        const items = inline(doc);
        expect(
            items.filter((i) =>
                i.kind.startsWith('line:cm-md-quote cm-md-callout')
            )
        ).toHaveLength(2);
        expect(has(items, 'CalloutTitleWidget')).toBe(true);
    });

    it('renders links and keeps the target for Cmd-click', () => {
        const state = stateFor('see [docs](https://x.dev) now\ntail');
        const { decorations } = buildLivePreview(state, [
            { from: 0, to: state.doc.length },
        ]);
        const items = flatten(decorations);
        expect(has(items, 'mark:cm-md-link', 5, 9)).toBe(true);
        expect(has(items, 'hide', 4, 5)).toBe(true);
        expect(has(items, 'hide', 9, 25)).toBe(true);
    });

    it('marks wikilinks but ignores them inside inline code', () => {
        const items = inline('[[Note]] and `[[Code]]`\ntail');
        expect(has(items, 'mark:cm-md-wikilink', 2, 6)).toBe(true);
        expect(
            items.filter((i) => i.kind === 'mark:cm-md-wikilink')
        ).toHaveLength(1);
    });

    it('renders images as a widget off-line', () => {
        const items = inline('![alt](/x.png)\ntail');
        expect(has(items, 'ImageWidget', 0, 14)).toBe(true);
    });

    it('replaces a horizontal rule with a widget', () => {
        const items = inline('above\n\n---\n\ntail');
        expect(has(items, 'HRWidget')).toBe(true);
    });

    it('styles blockquote lines', () => {
        const items = inline('> quote\n\ntail');
        expect(has(items, 'line:cm-md-quote', 0)).toBe(true);
    });
});

describe('block widgets', () => {
    const blocks = (doc: string, cursor = doc.length) =>
        flatten(buildBlockWidgets(stateFor(doc, cursor)));

    it('renders a top-level table as a widget when the caret is outside', () => {
        const doc = '| a | b |\n|---|---|\n| 1 | 2 |\n\ntail';
        expect(blocks(doc).map((i) => i.kind)).toEqual(['TableWidget']);
    });

    it('shows the table source when the caret is inside it', () => {
        const doc = '| a | b |\n|---|---|\n| 1 | 2 |\n\ntail';
        expect(blocks(doc, 3)).toEqual([]);
        const items = inline(doc, 3);
        expect(
            items.filter((i) => i.kind === 'line:cm-md-table-src')
        ).toHaveLength(3);
    });

    it('leaves tables to the block widget instead of decorating their inline content', () => {
        const doc = '| **a** | b |\n|---|---|\n| 1 | 2 |\n\ntail';
        expect(inline(doc).some((i) => i.kind === 'mark:cm-md-bold')).toBe(
            false
        );
    });

    it('renders mermaid fences as a widget and other fences as code', () => {
        expect(
            blocks('```mermaid\ngraph TD; A-->B\n```\n\ntail').map(
                (i) => i.kind
            )
        ).toEqual(['MermaidWidget']);
        expect(blocks('```js\nx\n```\n\ntail')).toEqual([]);
    });

    it('does not render a nested table as a block widget', () => {
        const doc = '- item\n\n  | a |\n  |---|\n  | 1 |\n\ntail';
        expect(blocks(doc)).toEqual([]);
    });
});

describe('checkbox interaction', () => {
    it('toggles the task marker in the document on click', () => {
        const parent = document.createElement('div');
        document.body.append(parent);
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc: '- [ ] todo\n\ntail',
                selection: { anchor: 16 },
                extensions: [
                    markdown({ base: markdownLanguage }),
                    livePreviewExtension(),
                ],
            }),
        });

        const box = parent.querySelector('.cm-md-checkbox') as HTMLElement;
        expect(box).not.toBeNull();
        box.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        );
        expect(view.state.doc.toString()).toBe('- [x] todo\n\ntail');

        view.destroy();
        parent.remove();
    });

    it('does not toggle in a read-only editor', () => {
        const parent = document.createElement('div');
        document.body.append(parent);
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc: '- [ ] todo\n\ntail',
                selection: { anchor: 16 },
                extensions: [
                    markdown({ base: markdownLanguage }),
                    EditorState.readOnly.of(true),
                    livePreviewExtension(),
                ],
            }),
        });

        const box = parent.querySelector('.cm-md-checkbox') as HTMLElement;
        box.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        );
        expect(view.state.doc.toString()).toBe('- [ ] todo\n\ntail');

        view.destroy();
        parent.remove();
    });
});

describe('table widget in a real view', () => {
    it('renders formatted cells and reveals the source on click', () => {
        const parent = document.createElement('div');
        document.body.append(parent);
        const doc =
            '| Name | Qty |\n|------|----:|\n| **Apple** | 3 |\n| `Pear` | 12 |\n\ntail';
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc,
                selection: { anchor: doc.length },
                extensions: [
                    markdown({ base: markdownLanguage }),
                    livePreviewExtension(),
                ],
            }),
        });

        const table = parent.querySelector('table.cm-md-table') as HTMLElement;
        expect(table).not.toBeNull();
        expect(table.querySelector('strong')?.textContent).toBe('Apple');
        expect(table.querySelector('code')?.textContent).toBe('Pear');
        expect(
            (table.querySelectorAll('td')[1] as HTMLElement).style.textAlign
        ).toBe('right');

        const wrap = parent.querySelector('.cm-md-table-wrap') as HTMLElement;
        wrap.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        );
        expect(view.state.selection.main.head).toBe(0);
        expect(parent.querySelector('table.cm-md-table')).toBeNull();

        view.destroy();
        parent.remove();
    });
});
