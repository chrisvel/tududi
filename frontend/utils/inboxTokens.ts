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

// One rule for a quoted name (+"Project", @"Full Name", ~"Area"), the same as
// backend/modules/inbox/quotedName.js. Inside the quotes \" is a quote and \\
// is a backslash; any other backslash is kept as it is. The first quote that
// is not escaped ends the name, and a quote that never closes is just a
// character.
const QUOTED_CHAR = String.raw`(?:\\["\\]|\\(?!["\\])|[^"\\])`;
export const QUOTED_NAME = `"${QUOTED_CHAR}*"`;
export const QUOTED_NAME_NONEMPTY = `"${QUOTED_CHAR}+"`;

const WHOLE_QUOTED_NAME = new RegExp(`^${QUOTED_NAME}$`);

// Length of the quoted name that opens at text[start], or 0 when that quote
// never closes.
const quotedNameLength = (text: string, start: number): number => {
    const pattern = new RegExp(QUOTED_NAME, 'y');
    pattern.lastIndex = start;
    const match = pattern.exec(text);
    return match ? match[0].length : 0;
};

// A name with its quotes and backslashes escaped, as it sits between the
// quotes of a token.
export const escapeTokenName = (name: string): string =>
    name.replace(/["\\]/g, '\\$&');

// Writes a name for a +project, @person or ~area token. A name with a space
// or a quote is quoted and escaped, so the box reads the same name back.
export const formatTokenName = (name: string): string =>
    /[\s"]/.test(name) ? `"${escapeTokenName(name)}"` : name;

// The name in a token, without its quotes and escapes. An unquoted name, or
// one whose quote never closes, is returned as it is.
export const readTokenName = (name: string): string =>
    WHOLE_QUOTED_NAME.test(name)
        ? name.slice(1, -1).replace(/\\(["\\])/g, '$1')
        : name;

// Splits text on spaces, keeping a quoted name after + or @ in one token.
export const tokenizeInboxText = (text: string): string[] => {
    const tokens: string[] = [];
    let currentToken = '';
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        const quoted =
            char === '"' &&
            (i === 0 || text[i - 1] === '+' || text[i - 1] === '@')
                ? quotedNameLength(text, i)
                : 0;

        if (quoted) {
            currentToken += text.slice(i, i + quoted);
            i += quoted;
        } else if (char === ' ') {
            if (currentToken) {
                tokens.push(currentToken);
                currentToken = '';
            }
            i++;
        } else {
            currentToken += char;
            i++;
        }
    }

    if (currentToken) tokens.push(currentToken);
    return tokens;
};

// A +project at the end of the text, +"Name" or +Name, for the project
// suggestions. Group 1 is the quoted name still escaped (read it with
// readTokenName(`"${group}"`)), group 2 the plain one.
export const PROJECT_QUERY_PATTERN = new RegExp(
    `\\+(?:"(${QUOTED_CHAR}*)"|([a-zA-Z0-9_\\s]*))$`
);

export const splitInboxTokens = (text: string): InboxTextSegment[] => {
    const segments: InboxTextSegment[] = [];
    const pattern = new RegExp(
        `(^|\\s)([#+@~](?:${QUOTED_NAME}|[^\\s"]+))`,
        'g'
    );
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
