import { EditorView } from '@codemirror/view';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const calloutTheme = (type: string, rgb: string) => ({
    [`.cm-md-callout-${type}`]: {
        backgroundColor: `rgba(${rgb}, 0.1)`,
        borderLeftColor: `rgb(${rgb})`,
    },
});

export const livePreviewTheme = EditorView.baseTheme({
    '.cm-md-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-md-h2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.3' },
    '.cm-md-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4' },
    '.cm-md-h4': { fontSize: '1.1em', fontWeight: '600' },
    '.cm-md-h5': { fontSize: '1em', fontWeight: '600', opacity: '0.85' },
    '.cm-md-h6': { fontSize: '0.9em', fontWeight: '600', opacity: '0.7' },

    '.cm-md-bold': { fontWeight: '700' },
    '.cm-md-italic': { fontStyle: 'italic' },
    '.cm-md-strike': { textDecoration: 'line-through', opacity: '0.65' },
    '.cm-md-code': {
        fontFamily: MONO,
        fontSize: '0.875em',
        borderRadius: '3px',
        padding: '1px 4px',
    },
    '&light .cm-md-code': { background: 'rgba(0,0,0,0.07)' },
    '&dark .cm-md-code': { background: 'rgba(255,255,255,0.1)' },

    '.cm-md-marker': { opacity: '0.4' },

    '.cm-md-link': {
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
    },
    '&light .cm-md-link': { color: '#2563eb' },
    '&dark .cm-md-link': { color: '#60a5fa' },
    '&.cm-mod-pressed .cm-md-link, &.cm-mod-pressed .cm-md-wikilink': {
        cursor: 'pointer',
    },
    '.cm-md-wikilink': { textUnderlineOffset: '2px' },
    '&light .cm-md-wikilink': { color: '#2563eb' },
    '&dark .cm-md-wikilink': { color: '#60a5fa' },
    // Matches the NOTE: badge note links get in read-only markdown.
    // inline-block stops an underline from a surrounding syntax-highlight
    // span reaching the chip; the rule below clears it on nested spans.
    '.cm-md-wikilink-chip': {
        display: 'inline-block',
        lineHeight: '1.4',
        cursor: 'pointer',
        textDecoration: 'none !important',
        borderRadius: '4px',
        padding: '1px 6px 1px 0',
        border: '1px solid',
    },
    '.cm-md-wikilink-chip *': { textDecoration: 'none !important' },
    '.cm-md-wikilink-chip::before': {
        content: '"NOTE:"',
        fontSize: '0.72em',
        fontWeight: '700',
        letterSpacing: '0.025em',
        padding: '2px 6px',
        marginRight: '6px',
        borderRadius: '3px 0 0 3px',
        verticalAlign: '1px',
    },
    '&light .cm-md-wikilink-chip': {
        color: '#1d4ed8',
        background: 'rgba(239, 246, 255, 0.8)',
        borderColor: '#bfdbfe',
    },
    '&light .cm-md-wikilink-chip::before': {
        color: '#1e40af',
        background: 'rgba(191, 219, 254, 0.7)',
    },
    '&dark .cm-md-wikilink-chip': {
        color: '#93c5fd',
        background: 'rgba(30, 58, 138, 0.3)',
        borderColor: 'rgba(29, 78, 216, 0.7)',
    },
    '&dark .cm-md-wikilink-chip::before': {
        color: '#bfdbfe',
        background: 'rgba(29, 78, 216, 0.6)',
    },

    '.cm-md-quote': {
        borderLeft: '3px solid rgba(128,128,128,0.5)',
        paddingLeft: '0.75em !important',
    },
    '.cm-md-callout': { borderLeftWidth: '4px' },
    '.cm-md-callout-first': { borderTopRightRadius: '6px', paddingTop: '4px' },
    ...calloutTheme('note', '96, 165, 250'),
    ...calloutTheme('tip', '74, 222, 128'),
    ...calloutTheme('warning', '251, 191, 36'),
    ...calloutTheme('important', '192, 132, 252'),
    ...calloutTheme('danger', '248, 113, 113'),
    '.cm-md-callout-label': {
        display: 'inline-flex',
        gap: '0.4em',
        fontWeight: '600',
        fontSize: '0.9em',
    },

    '.cm-md-bullet': {
        display: 'inline-block',
        width: '1.6em',
        textIndent: '0',
        textAlign: 'center',
    },
    '.cm-md-list-number': {
        display: 'inline-block',
        minWidth: '1.3em',
        textIndent: '0',
        opacity: '0.7',
    },
    '.cm-md-checkbox': {
        display: 'inline-block',
        width: '1.6em',
        textIndent: '0',
        verticalAlign: 'middle',
        cursor: 'pointer',
    },
    '.cm-md-checkbox input': { cursor: 'pointer', margin: '0' },
    '.cm-md-task-done': { textDecoration: 'line-through', opacity: '0.55' },

    '.cm-md-codeblock': {
        fontFamily: MONO,
        fontSize: '0.875em',
        paddingLeft: '0.9em !important',
        paddingRight: '0.9em !important',
    },
    '&light .cm-md-codeblock': { background: 'rgba(0,0,0,0.05)' },
    '&dark .cm-md-codeblock': { background: 'rgba(255,255,255,0.07)' },
    '.cm-md-codeblock-first': {
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
    },
    '.cm-md-codeblock-last': {
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
    },
    '.cm-md-code-lang': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '0.75em',
        textTransform: 'lowercase',
    },
    '.cm-md-code-lang > span': {
        opacity: '0.55',
    },
    '.cm-md-code-copy': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        opacity: '0.55',
        cursor: 'pointer',
        color: 'inherit',
        background: 'transparent',
    },
    '.cm-md-code-copy:hover, .cm-md-code-copy:focus-visible': {
        opacity: '1',
        background: 'rgba(127, 127, 127, 0.15)',
    },
    '.cm-md-code-copy svg': {
        width: '15px',
        height: '15px',
    },

    '.cm-md-hr': {
        height: '2px',
        margin: '8px 0',
        borderRadius: '1px',
    },
    '&light .cm-md-hr': { background: 'rgba(0,0,0,0.15)' },
    '&dark .cm-md-hr': { background: 'rgba(255,255,255,0.2)' },

    '.cm-md-image': { display: 'inline-block', maxWidth: '100%' },
    '.cm-md-image img': {
        maxWidth: '100%',
        maxHeight: '480px',
        borderRadius: '6px',
        verticalAlign: 'middle',
        cursor: 'pointer',
    },
    '.cm-md-image-broken': { opacity: '0.6', fontStyle: 'italic' },

    '.cm-md-table-src': { fontFamily: MONO, fontSize: '0.875em' },
    '.cm-md-table-wrap': {
        overflowX: 'auto',
        margin: '6px 0',
        cursor: 'text',
    },
    '.cm-md-table': {
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: '0.95em',
    },
    '.cm-md-table th, .cm-md-table td': {
        border: '1px solid rgba(128,128,128,0.35)',
        padding: '6px 10px',
        textAlign: 'left',
    },
    '.cm-md-table th': {
        fontWeight: '600',
        background: 'rgba(128,128,128,0.12)',
    },
    '.cm-md-table code': {
        fontFamily: MONO,
        fontSize: '0.875em',
        background: 'rgba(128,128,128,0.18)',
        borderRadius: '3px',
        padding: '1px 4px',
    },
    '.cm-md-mermaid': { margin: '6px 0', cursor: 'text', overflowX: 'auto' },
});
