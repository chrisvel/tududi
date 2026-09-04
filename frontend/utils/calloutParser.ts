import type { CalloutType } from '../components/Shared/CalloutBlock';

export interface CalloutMatch {
    type: CalloutType;
    title?: string;
    remainderText: string;
}

const CALLOUT_MARKER_REGEX =
    /^\[!(NOTE|WARNING|TIP|IMPORTANT|DANGER)\](?:\s+(.*))?$/i;

export function detectCallout(blockquoteNode: any): CalloutMatch | null {
    const children = blockquoteNode?.children ?? [];
    // remark/rehype insert whitespace text nodes (e.g. "\n") between block
    // children, so the paragraph is not necessarily at index 0
    const firstElement = children.find((c: any) => c?.type === 'element');
    if (!firstElement || firstElement.tagName !== 'p') {
        return null;
    }
    const firstText = firstElement.children?.[0];
    if (firstText?.type !== 'text' || typeof firstText.value !== 'string') {
        return null;
    }
    // Only the first line carries the marker and optional title; any
    // soft-wrapped lines after it belong to the callout body
    const newlineIndex = firstText.value.indexOf('\n');
    const firstLine =
        newlineIndex === -1
            ? firstText.value
            : firstText.value.slice(0, newlineIndex);
    const match = firstLine.match(CALLOUT_MARKER_REGEX);
    if (!match) {
        return null;
    }
    return {
        type: match[1].toUpperCase() as CalloutType,
        title: match[2]?.trim() || undefined,
        remainderText:
            newlineIndex === -1 ? '' : firstText.value.slice(newlineIndex + 1),
    };
}
