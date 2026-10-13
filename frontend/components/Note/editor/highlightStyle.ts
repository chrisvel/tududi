import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// A neutral palette for the note editor: structure comes from weight, style
// and opacity, never from hue, so the text keeps the note's own color.
const neutralHighlightStyle = HighlightStyle.define([
    { tag: tags.heading, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: [tags.link, tags.url], textDecoration: 'underline' },
    {
        tag: [
            tags.processingInstruction,
            tags.meta,
            tags.contentSeparator,
            tags.comment,
            tags.angleBracket,
        ],
        opacity: '0.5',
    },
]);

export const neutralEditorTheme = (isDark: boolean) => [
    // Marks the editor as light or dark so `&light`/`&dark` rules in the
    // live preview theme apply.
    EditorView.theme({}, { dark: isDark }),
    syntaxHighlighting(neutralHighlightStyle),
];
