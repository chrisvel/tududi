import { EditorState, TransactionSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

export type BlockKind =
    | 'paragraph'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'bullet'
    | 'ordered'
    | 'todo'
    | 'quote'
    | 'code'
    | 'callout'
    | 'table'
    | 'hr';

export interface Block {
    from: number;
    to: number;
    kind: BlockKind;
}

const HEADING_KIND: Record<string, BlockKind> = {
    ATXHeading1: 'h1',
    ATXHeading2: 'h2',
    ATXHeading3: 'h3',
    ATXHeading4: 'h3',
    ATXHeading5: 'h3',
    ATXHeading6: 'h3',
};

function nodeKind(node: SyntaxNode): BlockKind | null {
    if (HEADING_KIND[node.name]) return HEADING_KIND[node.name];
    if (node.name === 'FencedCode') return 'code';
    if (node.name === 'Table') return 'table';
    if (node.name === 'HorizontalRule') return 'hr';
    if (node.name === 'Blockquote') return 'quote';
    if (node.name === 'Paragraph' && node.parent?.name === 'Document') {
        return 'paragraph';
    }
    if (node.name === 'ListItem') {
        if (node.getChild('Task')) return 'todo';
        return node.parent?.name === 'OrderedList' ? 'ordered' : 'bullet';
    }
    return null;
}

// Walks up from the position to the nearest node that reads as a single
// editable block: a top-level paragraph/heading/quote/code/table/rule, or a
// list item (at whatever depth) together with any content nested under it.
export function blockNodeAt(
    state: EditorState,
    pos: number
): SyntaxNode | null {
    // side=1: biases toward the node that *starts* at pos rather than the
    // one that ends there, so a position sitting exactly at a block's start
    // (very common here - callers pass a block's own `.from`) still
    // resolves into that block instead of stopping at Document.
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    while (node && node.name !== 'Document') {
        if (nodeKind(node)) return node;
        node = node.parent;
    }
    return null;
}

export function blockAt(state: EditorState, pos: number): Block | null {
    const node = blockNodeAt(state, pos);
    if (!node) return null;
    const kind = nodeKind(node);
    if (!kind) return null;
    return { from: node.from, to: node.to, kind };
}

function directChildren(node: SyntaxNode): SyntaxNode[] {
    const out: SyntaxNode[] = [];
    let child = node.firstChild;
    while (child) {
        out.push(child);
        child = child.nextSibling;
    }
    return out;
}

interface Sibling {
    node: SyntaxNode;
    parent: SyntaxNode;
    siblings: SyntaxNode[];
    index: number;
}

// Lezer's SyntaxNode objects are wrappers created on demand: a node reached
// by walking up from a position and one reached by walking a parent's child
// list can describe the exact same range without being `===`. Compare by
// position instead of identity everywhere nodes need to be matched.
const sameNode = (a: SyntaxNode, b: SyntaxNode): boolean =>
    a.from === b.from && a.to === b.to && a.name === b.name;

function siblingInfo(state: EditorState, pos: number): Sibling | null {
    const node = blockNodeAt(state, pos);
    if (!node) return null;
    const parent = node.parent;
    if (!parent) return null;
    const siblings = directChildren(parent);
    const index = siblings.findIndex((s) => sameNode(s, node));
    if (index === -1) return null;
    return { node, parent, siblings, index };
}

// The block's own range plus the gap up to (not including) whatever comes
// after it, so moving/duplicating/deleting a block takes its blank-line
// separator along for the ride instead of leaving or doubling gaps.
function extendedRange(
    siblings: SyntaxNode[],
    parentTo: number,
    index: number
): { from: number; to: number } {
    const node = siblings[index];
    const next = siblings[index + 1];
    return { from: node.from, to: next ? next.from : parentTo };
}

export function moveBlock(
    state: EditorState,
    pos: number,
    dir: 1 | -1
): TransactionSpec | null {
    const info = siblingInfo(state, pos);
    if (!info) return null;
    const { node, parent, siblings, index } = info;
    const otherIndex = index + dir;
    if (otherIndex < 0 || otherIndex >= siblings.length) return null;

    const lowIndex = Math.min(index, otherIndex);
    const highIndex = Math.max(index, otherIndex);
    const low = extendedRange(siblings, parent.to, lowIndex);
    const high = extendedRange(siblings, parent.to, highIndex);
    const lowText = state.sliceDoc(low.from, low.to);
    const highText = state.sliceDoc(high.from, high.to);
    const newRegion = highText + lowText;

    const offsetWithinBlock = pos - node.from;
    const movedBlockStart = dir === 1 ? low.from + highText.length : low.from;

    return {
        changes: { from: low.from, to: high.to, insert: newRegion },
        selection: {
            anchor: Math.min(
                movedBlockStart + offsetWithinBlock,
                low.from + newRegion.length
            ),
        },
    };
}

export function duplicateBlock(
    state: EditorState,
    pos: number
): TransactionSpec | null {
    const info = siblingInfo(state, pos);
    if (!info) return null;
    const { parent, siblings, index } = info;
    const range = extendedRange(siblings, parent.to, index);
    let text = state.sliceDoc(range.from, range.to);

    const isLast = index === siblings.length - 1;
    if (isLast && !text.endsWith('\n\n')) {
        text = (text.endsWith('\n') ? '\n' : '\n\n') + text;
    }

    return {
        changes: { from: range.to, to: range.to, insert: text },
        selection: { anchor: range.to + text.length },
    };
}

export function deleteBlock(
    state: EditorState,
    pos: number
): TransactionSpec | null {
    const info = siblingInfo(state, pos);
    if (!info) return null;
    const { node, parent, siblings, index } = info;

    let from: number;
    let to: number;
    if (index + 1 < siblings.length) {
        from = node.from;
        to = siblings[index + 1].from;
    } else if (index > 0) {
        from = siblings[index - 1].to;
        to = node.to;
    } else {
        from = parent.from;
        to = parent.to;
    }

    return {
        changes: { from, to, insert: '' },
        selection: { anchor: from },
    };
}

// Inserts a new empty block right after the one at `pos` and leaves the
// caret right after a '/', so the editor's own slash-trigger detection (in
// MarkdownEditor's update listener) picks it up on the next render and
// opens the slash menu - no direct coupling to that component needed.
export function insertBlockBelow(
    state: EditorState,
    pos: number
): TransactionSpec | null {
    const info = siblingInfo(state, pos);
    if (!info) return null;
    const { parent, siblings, index } = info;
    const isLast = index === siblings.length - 1;
    const endPos = isLast ? parent.to : siblings[index + 1].from;
    const insertText = isLast ? '\n\n/' : '/\n\n';
    const cursorOffset = isLast ? insertText.length : 1;

    return {
        changes: { from: endPos, to: endPos, insert: insertText },
        selection: { anchor: endPos + cursorOffset },
    };
}

// Moves the block at `sourcePos` to just before/after the block at
// `targetPos`, within the same list/document level. Unlike moveBlock (an
// adjacent swap, used by the keyboard shortcut), this supports an arbitrary
// source/target pair, for drag-and-drop reordering.
export function reorderBlock(
    state: EditorState,
    sourcePos: number,
    targetPos: number,
    placeBefore: boolean
): TransactionSpec | null {
    const src = siblingInfo(state, sourcePos);
    const tgt = siblingInfo(state, targetPos);
    if (!src || !tgt) return null;
    if (!sameNode(src.parent, tgt.parent)) return null;
    if (sameNode(src.node, tgt.node)) return null;

    const { parent, siblings, index: srcIndex, node: srcNode } = src;

    // src and tgt are distinct nodes under the same parent, so siblings has
    // at least 2 entries - there's always a real gap between two of them to
    // read this level's separator from.
    const separator = state.sliceDoc(siblings[0].to, siblings[1].from);

    const ownText = state.sliceDoc(srcNode.from, srcNode.to);
    const atVeryEnd = !placeBefore && tgt.index === siblings.length - 1;
    // Everywhere but the very end of the parent, something follows the
    // moved block, so the separator trails it; at the very end there's
    // nothing after it to separate from, but it still needs a leading gap
    // from whatever now precedes it (mirrors duplicateBlock's last-sibling
    // case).
    const insertText = atVeryEnd ? separator + ownText : ownText + separator;

    // The range to remove from the old spot: same asymmetric rule as
    // deleteBlock (trailing gap if something follows, else the leading
    // gap), so the old neighbouring gap never lingers once the block that
    // owned it is gone.
    const removeRange =
        srcIndex + 1 < siblings.length
            ? { from: srcNode.from, to: siblings[srcIndex + 1].from }
            : { from: siblings[srcIndex - 1].to, to: srcNode.to };

    const insertPos = atVeryEnd
        ? parent.to
        : placeBefore
          ? tgt.node.from
          : siblings[tgt.index + 1].from;

    return {
        changes: [
            { from: removeRange.from, to: removeRange.to, insert: '' },
            { from: insertPos, to: insertPos, insert: insertText },
        ],
        selection: { anchor: insertPos },
    };
}

const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/;

// Extracts a block's text with its leading marker (#, -, >, [ ]...) removed.
// Only single-line blocks are supported: turning a multi-paragraph quote or
// a multi-line list item into something else is intentionally left alone
// rather than guessing which line the user means.
function blockPlainText(state: EditorState, node: SyntaxNode): string | null {
    const fromLine = state.doc.lineAt(node.from).number;
    const toLine = state.doc.lineAt(node.to).number;

    if (node.name === 'FencedCode') {
        // Only a fence with exactly one content line (``` / text / ```)
        // round-trips into a single-line block kind.
        if (toLine - fromLine !== 2) return null;
        return state.doc.line(fromLine + 1).text;
    }

    if (toLine !== fromLine) return null;

    const text = state.sliceDoc(node.from, node.to);
    if (node.name === 'Blockquote') {
        return text.replace(/^>\s?/, '');
    }
    if (node.name === 'ListItem') {
        return text.replace(LIST_MARKER, '');
    }
    const heading = HEADING_KIND[node.name];
    if (heading) {
        return text.replace(/^#{1,6}\s?/, '');
    }
    return text;
}

function renderBlock(kind: BlockKind, content: string): string {
    switch (kind) {
        case 'h1':
            return `# ${content}`;
        case 'h2':
            return `## ${content}`;
        case 'h3':
            return `### ${content}`;
        case 'bullet':
            return `- ${content}`;
        case 'ordered':
            return `1. ${content}`;
        case 'todo':
            return `- [ ] ${content}`;
        case 'quote':
            return `> ${content}`;
        case 'callout':
            return `> [!NOTE]\n> ${content}`;
        case 'code':
            return `\`\`\`\n${content}\n\`\`\``;
        case 'paragraph':
        default:
            return content;
    }
}

export function turnInto(
    state: EditorState,
    pos: number,
    kind: BlockKind
): TransactionSpec | null {
    const node = blockNodeAt(state, pos);
    if (!node) return null;
    const sourceKind = nodeKind(node);
    if (sourceKind === 'table' || sourceKind === 'hr') return null;

    const content = blockPlainText(state, node);
    if (content === null) return null;

    const insert = renderBlock(kind, content);
    return {
        changes: { from: node.from, to: node.to, insert },
        selection: { anchor: node.from + insert.length },
    };
}
