import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
    blockAt,
    moveBlock,
    duplicateBlock,
    deleteBlock,
    turnInto,
    insertBlockBelow,
    reorderBlock,
} from '../blocks';

const stateFor = (doc: string) =>
    EditorState.create({
        doc,
        extensions: [markdown({ base: markdownLanguage })],
    });

const apply = (
    state: EditorState,
    spec: ReturnType<typeof moveBlock>
): { doc: string; anchor: number } => {
    if (!spec) throw new Error('expected a transaction spec');
    const tr = state.update(spec);
    return {
        doc: tr.state.doc.toString(),
        anchor: tr.state.selection.main.anchor,
    };
};

describe('blockAt', () => {
    it('identifies a top-level paragraph', () => {
        const state = stateFor('Hello world');
        expect(blockAt(state, 3)).toEqual({
            from: 0,
            to: 11,
            kind: 'paragraph',
        });
    });

    it('identifies a heading by level', () => {
        const state = stateFor('### Title\n\nBody');
        expect(blockAt(state, 5)?.kind).toBe('h3');
    });

    it('identifies a bullet list item, not its paragraph', () => {
        const state = stateFor('- item one');
        const block = blockAt(state, 5);
        expect(block).toEqual({ from: 0, to: 10, kind: 'bullet' });
    });

    it('identifies a to-do item', () => {
        const state = stateFor('- [ ] task');
        expect(blockAt(state, 6)?.kind).toBe('todo');
    });

    it('identifies an ordered list item', () => {
        const state = stateFor('1. first');
        expect(blockAt(state, 4)?.kind).toBe('ordered');
    });

    it('resolves a nested list item to itself, not its parent item', () => {
        const doc = '- outer\n  - inner';
        const state = stateFor(doc);
        const innerPos = doc.indexOf('inner') + 1;
        const block = blockAt(state, innerPos);
        expect(state.sliceDoc(block!.from, block!.to)).toBe('- inner');
    });

    it('identifies a fenced code block', () => {
        const state = stateFor('```js\ncode\n```');
        expect(blockAt(state, 8)?.kind).toBe('code');
    });

    it('identifies a table', () => {
        const state = stateFor('| a | b |\n|---|---|\n| 1 | 2 |');
        expect(blockAt(state, 12)?.kind).toBe('table');
    });

    it('identifies a blockquote', () => {
        const state = stateFor('> quoted');
        expect(blockAt(state, 3)?.kind).toBe('quote');
    });

    it('returns null outside any block', () => {
        const state = stateFor('');
        expect(blockAt(state, 0)).toBeNull();
    });
});

describe('moveBlock', () => {
    it('swaps two adjacent paragraphs downward', () => {
        const state = stateFor('A\n\nB\n\nC');
        const { doc, anchor } = apply(state, moveBlock(state, 0, 1));
        expect(doc).toBe('B\n\nA\n\nC');
        expect(doc[anchor]).toBe('A');
    });

    it('swaps two adjacent paragraphs upward, from the lower block', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInB = state.doc.toString().indexOf('B');
        const { doc, anchor } = apply(state, moveBlock(state, posInB, -1));
        expect(doc).toBe('B\n\nA\n\nC');
        expect(doc[anchor]).toBe('B');
    });

    it('refuses to move the first block up or the last block down', () => {
        const state = stateFor('A\n\nB');
        expect(moveBlock(state, 0, -1)).toBeNull();
        const posInB = state.doc.toString().indexOf('B');
        expect(moveBlock(state, posInB, 1)).toBeNull();
    });

    it('moves a list item within its own list, leaving other lists untouched', () => {
        const state = stateFor('- one\n- two\n- three');
        const posInTwo = state.doc.toString().indexOf('two');
        const { doc } = apply(state, moveBlock(state, posInTwo, -1));
        expect(doc).toBe('- two\n- one\n- three');
    });

    it('does not move a list item past the list into sibling document content', () => {
        const doc = '- one\n- two\n\nAfter';
        const state = stateFor(doc);
        const posInTwo = state.doc.toString().indexOf('two');
        expect(moveBlock(state, posInTwo, 1)).toBeNull();
    });
});

describe('duplicateBlock', () => {
    it('duplicates a middle paragraph right after itself', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInB = state.doc.toString().indexOf('B');
        const { doc } = apply(state, duplicateBlock(state, posInB));
        expect(doc).toBe('A\n\nB\n\nB\n\nC');
    });

    it('duplicates the last block with a proper blank-line separator', () => {
        const state = stateFor('A\n\nB');
        const posInB = state.doc.toString().indexOf('B');
        const { doc } = apply(state, duplicateBlock(state, posInB));
        expect(doc).toBe('A\n\nB\n\nB');
    });

    it('duplicates a tight list item without adding a blank line', () => {
        const state = stateFor('- one\n- two');
        const { doc } = apply(state, duplicateBlock(state, 2));
        expect(doc).toBe('- one\n- one\n- two');
    });
});

describe('deleteBlock', () => {
    it('deletes a middle paragraph and its trailing gap', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInB = state.doc.toString().indexOf('B');
        const { doc } = apply(state, deleteBlock(state, posInB));
        expect(doc).toBe('A\n\nC');
    });

    it('deletes the last block and its leading gap', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInC = state.doc.toString().indexOf('C');
        const { doc } = apply(state, deleteBlock(state, posInC));
        expect(doc).toBe('A\n\nB');
    });

    it('deletes the only block, leaving an empty document', () => {
        const state = stateFor('Only paragraph');
        const { doc } = apply(state, deleteBlock(state, 2));
        expect(doc).toBe('');
    });
});

describe('turnInto', () => {
    it('changes heading level', () => {
        const state = stateFor('# Title\n\nBody');
        const { doc } = apply(state, turnInto(state, 3, 'h2'));
        expect(doc).toBe('## Title\n\nBody');
    });

    it('turns a paragraph into a bullet', () => {
        const state = stateFor('Just text');
        const { doc } = apply(state, turnInto(state, 3, 'bullet'));
        expect(doc).toBe('- Just text');
    });

    it('turns a bullet item into a to-do', () => {
        const state = stateFor('- item');
        const { doc } = apply(state, turnInto(state, 3, 'todo'));
        expect(doc).toBe('- [ ] item');
    });

    it('turns a to-do back into a plain paragraph', () => {
        const state = stateFor('- [x] done');
        const { doc } = apply(state, turnInto(state, 6, 'paragraph'));
        expect(doc).toBe('done');
    });

    it('turns a single-line blockquote into a heading', () => {
        const state = stateFor('> Quoted line');
        const { doc } = apply(state, turnInto(state, 3, 'h1'));
        expect(doc).toBe('# Quoted line');
    });

    it('collapses a single-line fenced code block into a quote', () => {
        const state = stateFor('```\ncode line\n```');
        const { doc } = apply(state, turnInto(state, 6, 'quote'));
        expect(doc).toBe('> code line');
    });

    it('wraps a paragraph into a fenced code block', () => {
        const state = stateFor('plain text');
        const { doc } = apply(state, turnInto(state, 3, 'code'));
        expect(doc).toBe('```\nplain text\n```');
    });

    it('turns a paragraph into a two-line callout', () => {
        const state = stateFor('Heads up');
        const { doc } = apply(state, turnInto(state, 3, 'callout'));
        expect(doc).toBe('> [!NOTE]\n> Heads up');
    });

    it('refuses to turn a multi-line blockquote into anything (ambiguous)', () => {
        const state = stateFor('> line one\n> line two');
        expect(turnInto(state, 3, 'paragraph')).toBeNull();
    });

    it('refuses to turn a multi-line fenced code block', () => {
        const state = stateFor('```\nline one\nline two\n```');
        expect(turnInto(state, 6, 'quote')).toBeNull();
    });

    it('never turns a table or a horizontal rule into something else', () => {
        const table = stateFor('| a |\n|---|\n| 1 |');
        expect(turnInto(table, 2, 'paragraph')).toBeNull();

        const hr = stateFor('---');
        expect(turnInto(hr, 1, 'paragraph')).toBeNull();
    });
});

describe('insertBlockBelow', () => {
    it('inserts a slash-triggering line after a middle block, keeping the gap to the next', () => {
        const state = stateFor('A\n\nB\n\nC');
        const { doc, anchor } = apply(state, insertBlockBelow(state, 0));
        expect(doc).toBe('A\n\n/\n\nB\n\nC');
        expect(doc[anchor - 1]).toBe('/');
    });

    it('inserts a slash-triggering line after the last block', () => {
        const state = stateFor('A\n\nB');
        const posInB = state.doc.toString().indexOf('B');
        const { doc, anchor } = apply(state, insertBlockBelow(state, posInB));
        expect(doc).toBe('A\n\nB\n\n/');
        expect(doc[anchor - 1]).toBe('/');
    });
});

describe('reorderBlock', () => {
    it('drops a block before an earlier target', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInC = state.doc.toString().indexOf('C');
        const { doc } = apply(state, reorderBlock(state, posInC, 0, true));
        expect(doc).toBe('C\n\nA\n\nB');
    });

    it('drops a block after a later target', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInC = state.doc.toString().indexOf('C');
        const { doc } = apply(state, reorderBlock(state, 0, posInC, false));
        expect(doc).toBe('B\n\nC\n\nA');
    });

    it('drops a block after a target that is not the last sibling', () => {
        const state = stateFor('A\n\nB\n\nC');
        const posInB = state.doc.toString().indexOf('B');
        const { doc } = apply(state, reorderBlock(state, 0, posInB, false));
        expect(doc).toBe('B\n\nA\n\nC');
    });

    it('refuses to reorder across different list levels', () => {
        const doc = '- one\n- two\n\nplain paragraph';
        const state = stateFor(doc);
        const posInOne = 2;
        const posInParagraph = doc.indexOf('plain');
        expect(reorderBlock(state, posInOne, posInParagraph, true)).toBeNull();
    });

    it('is a no-op when source and target are the same block', () => {
        const state = stateFor('A\n\nB');
        expect(reorderBlock(state, 0, 0, true)).toBeNull();
    });
});
