import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { buildLivePreview } from '../livePreview';
import { livePreviewExtension } from '../index';
import { touchReading } from '../touchReading';

const mount = (doc: string, extensions: any[] = [], anchor = doc.length) => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc,
            selection: { anchor },
            extensions: [
                markdown({ base: markdownLanguage }),
                livePreviewExtension(),
                ...extensions,
            ],
        }),
    });
    const cleanup = () => {
        view.destroy();
        parent.remove();
    };
    return { view, parent, cleanup };
};

const editable = (view: EditorView) => view.state.facet(EditorView.editable);

const click = (el: Element) =>
    el.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
    );

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

const mousedown = (el: Element) =>
    el.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    );

describe('reading mode on touch screens (#1767)', () => {
    it('starts read-only so a long-press selects text instead of editing', () => {
        const { view, cleanup } = mount('Some **text**', [touchReading(true)]);
        expect(editable(view)).toBe(false);
        expect(view.contentDOM.getAttribute('contenteditable')).toBe('false');
        cleanup();
    });

    it('does nothing on devices with a mouse', () => {
        const { view, cleanup } = mount('Some text', [touchReading(false)]);
        expect(editable(view)).toBe(true);
        cleanup();
    });

    it('can start in editing for an empty or new note', () => {
        const { view, cleanup } = mount('', [
            touchReading(true, { startEditing: true }),
        ]);
        expect(editable(view)).toBe(true);
        cleanup();
    });

    it('switches to editing on a plain tap', () => {
        const { view, cleanup } = mount('Some text', [touchReading(true)]);
        click(view.contentDOM.querySelector('.cm-line') as Element);
        expect(editable(view)).toBe(true);
        expect(view.contentDOM.getAttribute('contenteditable')).toBe('true');
        cleanup();
    });

    it('keeps reading when the tap ends a text selection', () => {
        const { view, cleanup } = mount('Some text', [touchReading(true)]);
        view.dispatch({ selection: { anchor: 0, head: 4 } });
        click(view.contentDOM.querySelector('.cm-line') as Element);
        expect(editable(view)).toBe(false);
        cleanup();
    });

    it('goes back to reading when the editor loses focus', async () => {
        const { view, cleanup } = mount('Some text', [touchReading(true)]);
        click(view.contentDOM.querySelector('.cm-line') as Element);
        expect(editable(view)).toBe(true);
        // CodeMirror reports focus changes after a short delay.
        await settle();
        view.contentDOM.blur();
        await settle();
        expect(editable(view)).toBe(false);
        cleanup();
    });

    it('never reveals Markdown source while reading', () => {
        const state = EditorState.create({
            doc: 'a **bold** b',
            selection: { anchor: 5 },
            extensions: [
                markdown({ base: markdownLanguage }),
                EditorView.editable.of(false),
            ],
        });
        const result = buildLivePreview(state, [
            { from: 0, to: state.doc.length },
        ]);
        const hidden: Array<[number, number]> = [];
        result.atomic.between(0, state.doc.length, (from, to) => {
            hidden.push([from, to]);
        });
        expect(hidden).toEqual([
            [2, 4],
            [8, 10],
        ]);
    });

    it('still ticks checkboxes while reading', () => {
        const { view, parent, cleanup } = mount('- [ ] todo\n\ntail', [
            touchReading(true),
        ]);
        mousedown(parent.querySelector('.cm-md-checkbox') as Element);
        expect(view.state.doc.toString()).toBe('- [x] todo\n\ntail');
        cleanup();
    });

    it('lets a table be selected instead of revealing its source', () => {
        const doc = '| A | B |\n|---|---|\n| 1 | 2 |\n\ntail';
        const { view, parent, cleanup } = mount(doc, [touchReading(true)]);
        mousedown(parent.querySelector('.cm-md-table-wrap') as Element);
        expect(view.state.selection.main.head).toBe(doc.length);
        expect(parent.querySelector('table.cm-md-table')).not.toBeNull();
        cleanup();
    });

    it('opens a link on a plain tap while reading', () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const { parent, cleanup } = mount(
            'see [site](https://example.com) here',
            [touchReading(true)]
        );
        mousedown(parent.querySelector('[data-href]') as Element);
        expect(open).toHaveBeenCalledWith(
            'https://example.com',
            '_blank',
            'noopener,noreferrer'
        );
        open.mockRestore();
        cleanup();
    });
});

describe('code block copy button (#1767)', () => {
    const doc = '```js\nconst a = 1;\nconst b = 2;\n```\n\ntail';

    beforeEach(() => {
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        });
    });

    it('copies the code without the fences', () => {
        const { parent, cleanup } = mount(doc);
        const button = parent.querySelector('.cm-md-code-copy') as Element;
        expect(button).not.toBeNull();
        click(button);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            'const a = 1;\nconst b = 2;'
        );
        cleanup();
    });

    it('copies without switching to editing while reading', () => {
        const { view, parent, cleanup } = mount(doc, [touchReading(true)]);
        const button = parent.querySelector('.cm-md-code-copy') as Element;
        mousedown(button);
        click(button);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(editable(view)).toBe(false);
        cleanup();
    });
});
