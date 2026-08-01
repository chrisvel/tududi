import {
    EditorView,
    ViewPlugin,
    ViewUpdate,
    Decoration,
    DecorationSet,
    WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';


const HEADING_CLASSES = [
    'cm-preview-h1',
    'cm-preview-h2',
    'cm-preview-h3',
    'cm-preview-h4',
    'cm-preview-h5',
    'cm-preview-h6',
];

function isCursorOnLine(view: EditorView, from: number, to: number): boolean {
    return view.state.selection.ranges.some(
        (r) => r.from <= to && r.to >= from
    );
}

class HRWidget extends WidgetType {
    toDOM(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'cm-preview-hr';
        return el;
    }
    eq(): boolean {
        return true;
    }
    ignoreEvent(): boolean {
        return true;
    }
}

interface DecoRange {
    from: number;
    to: number;
    deco: Decoration;
}

function collectInlineDecos(text: string, lineFrom: number): DecoRange[] {
    const ranges: DecoRange[] = [];
    const claimed = new Uint8Array(text.length + 1);

    function canClaim(start: number, end: number): boolean {
        for (let i = start; i < end; i++) {
            if (claimed[i]) return false;
        }
        return true;
    }

    function claimRange(start: number, end: number) {
        for (let i = start; i < end; i++) claimed[i] = 1;
    }

    function applyPattern(
        regex: RegExp,
        markerLen: number,
        cssClass: string
    ) {
        let m: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((m = regex.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            const contentLen = end - start - markerLen * 2;
            if (contentLen <= 0) continue;
            if (!canClaim(start, end)) continue;
            claimRange(start, end);

            ranges.push({
                from: lineFrom + start,
                to: lineFrom + start + markerLen,
                deco: Decoration.replace({}),
            });
            ranges.push({
                from: lineFrom + start + markerLen,
                to: lineFrom + end - markerLen,
                deco: Decoration.mark({ class: cssClass }),
            });
            ranges.push({
                from: lineFrom + end - markerLen,
                to: lineFrom + end,
                deco: Decoration.replace({}),
            });
        }
    }

    // Process longer/higher-priority markers first to prevent partial overlap
    applyPattern(/\*\*([^*\n]+?)\*\*/g, 2, 'cm-preview-bold');
    applyPattern(/__([^_\n]+?)__/g, 2, 'cm-preview-bold');
    applyPattern(/~~([^\n]+?)~~/g, 2, 'cm-preview-strikethrough');
    applyPattern(/`([^`\n]+?)`/g, 1, 'cm-preview-inline-code');
    applyPattern(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, 1, 'cm-preview-italic');
    applyPattern(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, 1, 'cm-preview-italic');
    // Wikilinks: always show as styled [[title]] text
    {
        const regex = /\[\[([^[\]\n]+?)\]\]/g;
        let m: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((m = regex.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            if (!canClaim(start, end)) continue;
            claimRange(start, end);

            ranges.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: Decoration.mark({ class: 'cm-preview-wikilink-edit' }),
            });
        }
    }

    return ranges;
}

function collectWikilinkEditDecos(text: string, lineFrom: number): DecoRange[] {
    const ranges: DecoRange[] = [];
    const regex = /\[\[([^[\]\n]+?)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
        ranges.push({
            from: lineFrom + m.index,
            to: lineFrom + m.index + m[0].length,
            deco: Decoration.mark({ class: 'cm-preview-wikilink-edit' }),
        });
    }
    return ranges;
}

function buildDecorations(view: EditorView): DecorationSet {
    const allRanges: DecoRange[] = [];
    const processedLines = new Set<number>();

    for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            if (!processedLines.has(line.from)) {
                processedLines.add(line.from);
                const lineText = line.text;
                const lineFrom = line.from;
                const lineTo = line.to;

                if (!isCursorOnLine(view, lineFrom, lineTo)) {
                    const headingMatch = lineText.match(/^(#{1,6}) /);

                    if (headingMatch) {
                        const level = Math.min(headingMatch[1].length, 6);
                        const prefixLen = headingMatch[0].length;

                        allRanges.push({
                            from: lineFrom,
                            to: lineFrom,
                            deco: Decoration.line({
                                attributes: { class: HEADING_CLASSES[level - 1] },
                            }),
                        });
                        allRanges.push({
                            from: lineFrom,
                            to: lineFrom + prefixLen,
                            deco: Decoration.replace({}),
                        });
                        allRanges.push(
                            ...collectInlineDecos(
                                lineText.slice(prefixLen),
                                lineFrom + prefixLen
                            )
                        );
                    } else if (
                        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(lineText) &&
                        lineText.trim().length >= 3
                    ) {
                        allRanges.push({
                            from: lineFrom,
                            to: lineTo,
                            deco: Decoration.replace({ widget: new HRWidget() }),
                        });
                    } else {
                        allRanges.push(...collectInlineDecos(lineText, lineFrom));
                    }
                } else {
                    // Cursor is on this line — show wikilinks as styled [[ title ]] only
                    allRanges.push(...collectWikilinkEditDecos(lineText, lineFrom));
                }
            }
            pos = line.to + 1;
        }
    }

    // Sort by from, then to (ascending) — required by RangeSetBuilder
    allRanges.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return a.to - b.to;
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to, deco } of allRanges) {
        builder.add(from, to, deco);
    }
    return builder.finish();
}

class LivePreviewPlugin {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = buildDecorations(update.view);
        }
    }
}

export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
    decorations: (v) => v.decorations,
});

export const livePreviewTheme = EditorView.baseTheme({
    '.cm-preview-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-preview-h2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-preview-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4' },
    '.cm-preview-h4': { fontSize: '1.1em', fontWeight: '600' },
    '.cm-preview-h5': { fontSize: '1em', fontWeight: '600', opacity: '0.85' },
    '.cm-preview-h6': { fontSize: '0.9em', fontWeight: '600', opacity: '0.7' },
    '.cm-preview-bold': { fontWeight: '700' },
    '.cm-preview-italic': { fontStyle: 'italic' },
    '.cm-preview-strikethrough': {
        textDecoration: 'line-through',
        opacity: '0.65',
    },
    '.cm-preview-inline-code': {
        fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.875em',
        borderRadius: '3px',
        padding: '1px 4px',
    },
    '&light .cm-preview-inline-code': {
        background: 'rgba(0,0,0,0.07)',
    },
    '&dark .cm-preview-inline-code': {
        background: 'rgba(255,255,255,0.1)',
    },
    '&light .cm-preview-wikilink-edit': { color: '#2563eb' },
    '&dark .cm-preview-wikilink-edit': { color: '#60a5fa' },

    '.cm-preview-hr': {
        height: '2px',
        margin: '8px 0',
        borderRadius: '1px',
    },
    '&light .cm-preview-hr': {
        background: 'rgba(0,0,0,0.15)',
    },
    '&dark .cm-preview-hr': {
        background: 'rgba(255,255,255,0.2)',
    },
});

export const livePreviewExtension = [livePreviewPlugin, livePreviewTheme];
