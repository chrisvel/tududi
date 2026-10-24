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
    const pattern = /(^|\s)([#+@~](?:"(?:\\["\\]|[^"])*"|[^\s"]+))/g;
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

// Writes a project name for a +project token. A name with a space or a quote
// is quoted, and the quotes and backslashes in it are escaped, so the box
// reads the same name back.
export const formatProjectTokenName = (name: string): string =>
    /[\s"]/.test(name) ? `"${name.replace(/["\\]/g, '\\$&')}"` : name;

// The project name in a +project token, without its quotes and escapes.
export const readProjectTokenName = (name: string): string =>
    name.startsWith('"') && name.endsWith('"')
        ? name.slice(1, -1).replace(/\\(["\\])/g, '$1')
        : name;
