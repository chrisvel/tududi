// Splits inbox text into plain runs and the tokens the box understands
// (#tag, +project, @person, ~area), so the edit box can colour them in place.
export type InboxTokenKind = 'tag' | 'project' | 'person' | 'area';

export interface InboxTextSegment {
    text: string;
    kind?: InboxTokenKind;
}

const KIND_BY_PREFIX: Record<string, InboxTokenKind> = {
    '#': 'tag',
    '+': 'project',
    '@': 'person',
    '~': 'area',
};

export const splitInboxTokens = (text: string): InboxTextSegment[] => {
    const segments: InboxTextSegment[] = [];
    const pattern = /(^|\s)([#+@~](?:"[^"]*"|[^\s"]+))/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const start = match.index + match[1].length;
        const token = match[2];
        if (start > last) segments.push({ text: text.slice(last, start) });
        segments.push({ text: token, kind: KIND_BY_PREFIX[token[0]] });
        last = start + token.length;
    }

    if (last < text.length) segments.push({ text: text.slice(last) });
    return segments;
};
