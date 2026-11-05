'use strict';

// One rule for a quoted name in inbox text (+"Project", @"Full Name",
// ~"Area"), shared by every parser so they all split the text the same way.
// Inside the quotes \" is a quote and \\ is a backslash; any other backslash
// is kept as it is. The first quote that is not escaped ends the name, and a
// quote that never closes is just a character. frontend/utils/inboxTokens.ts
// follows the same rule.

const QUOTED_CHAR = String.raw`(?:\\["\\]|\\(?!["\\])|[^"\\])`;

// "..." with an empty name allowed, and "..." with at least one character.
const QUOTED_NAME = `"${QUOTED_CHAR}*"`;
const QUOTED_NAME_NONEMPTY = `"${QUOTED_CHAR}+"`;

const WHOLE_QUOTED_NAME = new RegExp(`^${QUOTED_NAME}$`);

// Length of the quoted name that opens at text[start], or 0 when that quote
// never closes.
const quotedNameLength = (text, start) => {
    const pattern = new RegExp(QUOTED_NAME, 'y');
    pattern.lastIndex = start;
    const match = pattern.exec(text);
    return match ? match[0].length : 0;
};

const unescapeName = (value) => value.replace(/\\(["\\])/g, '$1');

// The name in a token, without its quotes and escapes. An unquoted name, or
// one whose quote never closes, is returned as it is.
const readTokenName = (value) =>
    WHOLE_QUOTED_NAME.test(value) ? unescapeName(value.slice(1, -1)) : value;

module.exports = {
    QUOTED_NAME,
    QUOTED_NAME_NONEMPTY,
    quotedNameLength,
    readTokenName,
    unescapeName,
};
