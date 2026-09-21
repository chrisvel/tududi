import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { MermaidWidget, TableData, TableWidget } from './widgets';

type SyntaxNode = ReturnType<typeof syntaxTree>['topNode'];

export type BlockWidgetKind = 'table' | 'mermaid';

export const selectionTouches = (
    state: EditorState,
    from: number,
    to: number
): boolean => state.selection.ranges.some((r) => r.from <= to && r.to >= from);

// Block-replacing decorations have to cover whole lines, so only top-level
// tables and fences get a rendered widget. Nested ones stay as source.
export function blockWidgetKind(
    state: EditorState,
    node: { name: string; node: SyntaxNode }
): BlockWidgetKind | null {
    if (node.node.parent?.name !== 'Document') return null;
    if (node.name === 'Table') return 'table';
    if (node.name === 'FencedCode') {
        const info = node.node.getChild('CodeInfo');
        if (
            info &&
            state.sliceDoc(info.from, info.to).trim().toLowerCase() ===
                'mermaid'
        ) {
            return 'mermaid';
        }
    }
    return null;
}

function splitRow(text: string): string[] {
    return text
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
}

function readTable(state: EditorState, node: SyntaxNode): TableData | null {
    const headerNode = node.getChild('TableHeader');
    if (!headerNode) return null;

    const cellsOf = (row: SyntaxNode): string[] =>
        row
            .getChildren('TableCell')
            .map((c) => state.sliceDoc(c.from, c.to).trim());

    const delimiter = node
        .getChildren('TableDelimiter')
        .find((d) => d.from !== headerNode.from && d.to - d.from > 1);
    const align = delimiter
        ? splitRow(state.sliceDoc(delimiter.from, delimiter.to)).map((spec) => {
              const left = spec.startsWith(':');
              const right = spec.endsWith(':');
              if (left && right) return 'center' as const;
              if (right) return 'right' as const;
              if (left) return 'left' as const;
              return null;
          })
        : [];

    const header = cellsOf(headerNode);
    return {
        header,
        align,
        rows: node.getChildren('TableRow').map(cellsOf),
    };
}

function readFenceBody(state: EditorState, node: SyntaxNode): string {
    const first = state.doc.lineAt(node.from);
    const marks = node.getChildren('CodeMark');
    const closed =
        marks.length >= 2 &&
        state.doc.lineAt(marks[marks.length - 1].from).number > first.number;
    const bodyFrom = Math.min(first.to + 1, node.to);
    const bodyTo = closed
        ? Math.max(
              bodyFrom,
              state.doc.lineAt(marks[marks.length - 1].from).from - 1
          )
        : node.to;
    return state.sliceDoc(bodyFrom, bodyTo);
}

export function buildBlockWidgets(state: EditorState): DecorationSet {
    const ranges: Range<Decoration>[] = [];
    const tree =
        ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state);

    tree.iterate({
        enter: (ref) => {
            const kind = blockWidgetKind(state, ref);
            if (!kind) return;
            if (selectionTouches(state, ref.from, ref.to)) return false;

            const node = ref.node;
            if (kind === 'table') {
                const data = readTable(state, node);
                if (!data || data.header.length === 0) return false;
                ranges.push(
                    Decoration.replace({
                        widget: new TableWidget(
                            data,
                            state.sliceDoc(ref.from, ref.to)
                        ),
                        block: true,
                    }).range(ref.from, ref.to)
                );
            } else {
                const code = readFenceBody(state, node);
                if (code.trim()) {
                    ranges.push(
                        Decoration.replace({
                            widget: new MermaidWidget(code),
                            block: true,
                        }).range(ref.from, ref.to)
                    );
                }
            }
            return false;
        },
    });

    return Decoration.set(ranges, true);
}

export const blockWidgetsField = StateField.define<DecorationSet>({
    create: (state) => buildBlockWidgets(state),
    update(value, tr) {
        if (
            tr.docChanged ||
            tr.selection ||
            syntaxTree(tr.startState) !== syntaxTree(tr.state)
        ) {
            return buildBlockWidgets(tr.state);
        }
        return value;
    },
    provide: (field) => [
        EditorView.decorations.from(field),
        EditorView.atomicRanges.of((view) => view.state.field(field)),
    ],
});
