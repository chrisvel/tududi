'use strict';

// Pure syntax shared by the browser and capture service. Quoted spans stay
// together, including +"Project name"; apostrophes inside words are literal.
function tokenizeCapture(content) {
    const tokens = [];
    let token = '';
    let quote = null;
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (quote) {
            token += char;
            if (char === '\\' && i + 1 < content.length) {
                token += content[++i];
            } else if (char === quote) {
                quote = null;
            }
        } else if (
            char === '"' ||
            (char === "'" &&
                (token === '' || token === '+' || /[([{]$/.test(token)))
        ) {
            quote = char;
            token += char;
        } else if (/\s/.test(char)) {
            if (token) tokens.push(token);
            token = '';
        } else {
            token += char;
        }
    }
    if (token) tokens.push(token);
    return tokens;
}

function hasTaskDirective(content) {
    return tokenizeCapture(content).some((token) => /^=task$/i.test(token));
}

function parseTaskCapture(content) {
    const tokens = tokenizeCapture(content);
    if (!tokens.some((token) => /^=task$/i.test(token))) return null;
    const title = [];
    const projects = [];
    const tags = [];
    for (const token of tokens) {
        if (/^=task$/i.test(token)) continue;
        if (token.startsWith('+') && token.length > 1) {
            let project = token.slice(1);
            if (project.startsWith('"') && project.endsWith('"')) {
                project = project.slice(1, -1);
            }
            projects.push(project);
        } else if (/^#[a-zA-Z0-9_-]+$/.test(token)) {
            if (!tags.includes(token.slice(1))) tags.push(token.slice(1));
        } else {
            title.push(token);
        }
    }
    return { name: title.join(' ').trim(), projects, tags };
}

module.exports = { tokenizeCapture, hasTaskDirective, parseTaskCapture };
