import { EditorState, Range } from '@codemirror/state';
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from '@codemirror/view';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { CALLOUT_MARKER_REGEX } from '../../../utils/calloutParser';
import type { CalloutType } from '../../Shared/CalloutBlock';
import { blockWidgetKind, selectionTouches } from './blockWidgets';
import {
    BulletWidget,
    CalloutTitleWidget,
    CheckboxWidget,
    CodeLangWidget,
    HRWidget,
    ImageWidget,
} from './widgets';

export interface LivePreviewResult {
    decorations: DecorationSet;
    atomic: DecorationSet;
}

interface TextRange {
    from: number;
    to: number;
}

const INLINE_MARK_CLASSES: Record<string, string> = {
    StrongEmphasis: 'cm-md-bold',
    Emphasis: 'cm-md-italic',
    Strikethrough: 'cm-md-strike',
    InlineCode: 'cm-md-code',
};

const INLINE_MARKER_NODES = new Set([
    'EmphasisMark',
    'StrikethroughMark',
    'CodeMark',
]);

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;
const LIST_INDENT = '1.6em';

export function buildLivePreview(
    state: EditorState,
    ranges: readonly TextRange[]
): LivePreviewResult {
    const deco: Range<Decoration>[] = [];
    const atomic: Range<Decoration>[] = [];
    const codeRanges: TextRange[] = [];
    const seenLines = new Set<string>();
    const doc = state.doc;

    const touches = (from: number, to: number) =>
        selectionTouches(state, from, to);
    const lineTouched = (pos: number) => {
        const line = doc.lineAt(pos);
        return touches(line.from, line.to);
    };

    const addLine = (
        pos: number,
        attributes: { class?: string; style?: string }
    ) => {
        const lineFrom = doc.lineAt(pos).from;
        const key = `${lineFrom}|${attributes.class ?? ''}|${attributes.style ?? ''}`;
        if (seenLines.has(key)) return;
        seenLines.add(key);
        deco.push(Decoration.line({ attributes }).range(lineFrom));
    };

    const addMark = (
        from: number,
        to: number,
        cls: string,
        attributes?: Record<string, string>
    ) => {
        if (from >= to) return;
        deco.push(Decoration.mark({ class: cls, attributes }).range(from, to));
    };

    const replace = (from: number, to: number, widget?: WidgetType) => {
        if (from >= to && !widget) return;
        const range = Decoration.replace(widget ? { widget } : {}).range(
            from,
            to
        );
        deco.push(range);
        atomic.push(range);
    };

    // Markers are dimmed while the caret is in their element and hidden
    // otherwise.
    const marker = (from: number, to: number, show: boolean) => {
        if (show) addMark(from, to, 'cm-md-marker');
        else replace(from, to);
    };

    const charAt = (pos: number) => doc.sliceString(pos, pos + 1);
    const withTrailingSpace = (pos: number) =>
        charAt(pos) === ' ' ? pos + 1 : pos;

    const tree =
        ensureSyntaxTree(state, Math.max(...ranges.map((r) => r.to), 0), 30) ??
        syntaxTree(state);

    for (const range of ranges) {
        tree.iterate({
            from: range.from,
            to: range.to,
            enter: (ref) => {
                const name = ref.name;

                const heading = /^ATXHeading([1-6])$/.exec(name);
                if (heading) {
                    addLine(ref.from, { class: `cm-md-h${heading[1]}` });
                    return;
                }

                if (name === 'HeaderMark') {
                    if (!ref.node.parent?.name.startsWith('ATXHeading')) return;
                    marker(
                        ref.from,
                        withTrailingSpace(ref.to),
                        lineTouched(ref.from)
                    );
                    return;
                }

                if (INLINE_MARK_CLASSES[name]) {
                    addMark(ref.from, ref.to, INLINE_MARK_CLASSES[name]);
                    if (name === 'InlineCode') {
                        codeRanges.push({ from: ref.from, to: ref.to });
                    }
                    return;
                }

                if (INLINE_MARKER_NODES.has(name)) {
                    const parent = ref.node.parent;
                    if (!parent) return;
                    marker(ref.from, ref.to, touches(parent.from, parent.to));
                    return;
                }

                if (name === 'Link' || name === 'Image') {
                    const url = ref.node.getChild('URL');
                    const marks = ref.node.getChildren('LinkMark');
                    if (!url || marks.length < 2) return;
                    const show = touches(ref.from, ref.to);
                    const textFrom = marks[0].to;
                    const textTo = marks[1].from;

                    if (name === 'Image') {
                        if (!show) {
                            replace(
                                ref.from,
                                ref.to,
                                new ImageWidget(
                                    state.sliceDoc(url.from, url.to),
                                    state.sliceDoc(textFrom, textTo)
                                )
                            );
                        }
                        return false;
                    }

                    addMark(textFrom, textTo, 'cm-md-link', {
                        'data-href': state.sliceDoc(url.from, url.to),
                    });
                    marker(marks[0].from, marks[0].to, show);
                    marker(marks[1].from, ref.to, show);
                    return;
                }

                if (name === 'Blockquote') {
                    const startLine = doc.lineAt(ref.from);
                    const endLine = doc.lineAt(ref.to);
                    const firstText = /^\s*>\s?(.*)$/.exec(startLine.text)?.[1];
                    const callout =
                        firstText !== undefined
                            ? CALLOUT_MARKER_REGEX.exec(firstText.trim())
                            : null;
                    const type = callout
                        ? (callout[1].toUpperCase() as CalloutType)
                        : null;

                    for (let n = startLine.number; n <= endLine.number; n++) {
                        const line = doc.line(n);
                        addLine(line.from, {
                            class: type
                                ? `cm-md-quote cm-md-callout cm-md-callout-${type.toLowerCase()}${n === startLine.number ? ' cm-md-callout-first' : ''}`
                                : 'cm-md-quote',
                        });
                    }

                    if (type && callout && !lineTouched(startLine.from)) {
                        const markerAt = startLine.text.indexOf('[!');
                        if (markerAt >= 0) {
                            replace(
                                startLine.from + markerAt,
                                startLine.to,
                                new CalloutTitleWidget(
                                    type,
                                    callout[2]?.trim() ?? ''
                                )
                            );
                        }
                    }
                    return;
                }

                if (name === 'QuoteMark') {
                    marker(
                        ref.from,
                        withTrailingSpace(ref.to),
                        lineTouched(ref.from)
                    );
                    return;
                }

                if (name === 'ListItem') {
                    const mark = ref.node.getChild('ListMark');
                    if (!mark) return;
                    let depth = 0;
                    for (
                        let p: typeof ref.node | null = ref.node;
                        p;
                        p = p.parent
                    ) {
                        if (p.name === 'ListItem') depth++;
                    }
                    const isTask = !!ref.node.getChild('Task');
                    const isBullet = ref.node.parent?.name === 'BulletList';

                    if (lineTouched(mark.from)) {
                        addMark(mark.from, mark.to, 'cm-md-marker');
                        return;
                    }

                    let wsFrom = mark.from;
                    while (wsFrom > 0 && /[ \t]/.test(charAt(wsFrom - 1))) {
                        wsFrom--;
                    }
                    const markEnd = withTrailingSpace(mark.to);
                    addLine(mark.from, {
                        style: `padding-left: calc(${depth} * ${LIST_INDENT}); text-indent: -${LIST_INDENT}`,
                    });

                    if (isTask) {
                        replace(wsFrom, markEnd);
                    } else if (isBullet) {
                        replace(wsFrom, markEnd, new BulletWidget());
                    } else {
                        replace(wsFrom, mark.from);
                        addMark(mark.from, mark.to, 'cm-md-list-number');
                    }
                    return;
                }

                if (name === 'TaskMarker') {
                    const checked = /\[[xX]\]/.test(
                        state.sliceDoc(ref.from, ref.to)
                    );
                    replace(ref.from, ref.to, new CheckboxWidget(checked));
                    const task = ref.node.parent;
                    if (checked && task) {
                        addMark(ref.to, task.to, 'cm-md-task-done');
                    }
                    return;
                }

                if (name === 'HorizontalRule') {
                    if (!lineTouched(ref.from)) {
                        replace(ref.from, ref.to, new HRWidget());
                    }
                    return;
                }

                if (name === 'FencedCode') {
                    codeRanges.push({ from: ref.from, to: ref.to });
                    const kind = blockWidgetKind(state, ref);
                    const active = touches(ref.from, ref.to);
                    if (kind === 'mermaid' && !active) return false;

                    const first = doc.lineAt(ref.from);
                    const last = doc.lineAt(ref.to);
                    for (let n = first.number; n <= last.number; n++) {
                        const line = doc.line(n);
                        addLine(line.from, {
                            class: `cm-md-codeblock${n === first.number ? ' cm-md-codeblock-first' : ''}${n === last.number ? ' cm-md-codeblock-last' : ''}`,
                        });
                    }

                    if (!active) {
                        const fence = /^\s*(`{3,}|~{3,})/;
                        const info = ref.node.getChild('CodeInfo');
                        if (fence.test(first.text)) {
                            replace(
                                first.from,
                                first.to,
                                new CodeLangWidget(
                                    info
                                        ? state
                                              .sliceDoc(info.from, info.to)
                                              .trim()
                                        : ''
                                )
                            );
                        }
                        const closing = ref.node.getChildren('CodeMark');
                        if (
                            closing.length >= 2 &&
                            last.number > first.number &&
                            fence.test(last.text)
                        ) {
                            replace(last.from, last.to);
                        }
                    }
                    return false;
                }

                if (name === 'Table') {
                    if (
                        blockWidgetKind(state, ref) &&
                        !touches(ref.from, ref.to)
                    ) {
                        return false;
                    }
                    const first = doc.lineAt(ref.from).number;
                    const last = doc.lineAt(ref.to).number;
                    for (let n = first; n <= last; n++) {
                        addLine(doc.line(n).from, { class: 'cm-md-table-src' });
                    }
                    return false;
                }
            },
        });

        const text = doc.sliceString(range.from, range.to);
        WIKILINK.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = WIKILINK.exec(text)) !== null) {
            const from = range.from + match.index;
            const to = from + match[0].length;
            if (codeRanges.some((c) => c.from < to && c.to > from)) continue;
            const show = touches(from, to);
            marker(from, from + 2, show);
            marker(to - 2, to, show);
            addMark(from + 2, to - 2, 'cm-md-wikilink', {
                'data-wikilink': match[1].trim(),
            });
        }
    }

    return {
        decorations: Decoration.set(deco, true),
        atomic: Decoration.set(atomic, true),
    };
}

class LivePreviewPlugin {
    decorations: DecorationSet = Decoration.none;
    atomic: DecorationSet = Decoration.none;

    constructor(view: EditorView) {
        this.rebuild(view);
    }

    update(update: ViewUpdate) {
        if (
            update.docChanged ||
            update.selectionSet ||
            update.viewportChanged ||
            syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
            this.rebuild(update.view);
        }
    }

    rebuild(view: EditorView) {
        const result = buildLivePreview(view.state, view.visibleRanges);
        this.decorations = result.decorations;
        this.atomic = result.atomic;
    }
}

export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
        EditorView.atomicRanges.of(
            (view) => view.plugin(plugin)?.atomic ?? Decoration.none
        ),
});
