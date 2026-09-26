// Web and mail links, and paths on this site such as a note's own files.
export const isSafeLinkUrl = (url: string): boolean => {
    const trimmed = url.trim();
    return /^(https?:\/\/|mailto:)/i.test(trimmed) || /^\/(?!\/)/.test(trimmed);
};

export const isSafeImageUrl = (url: string): boolean => {
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) || /^\/(?!\/)/.test(trimmed);
};

const TOKEN_PATTERN =
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)\s]+\))/;

export function renderInline(text: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let last = 0;
    // A fresh regex per call: the recursion below would otherwise reset the
    // shared lastIndex and loop forever on nested formatting.
    const TOKEN = new RegExp(TOKEN_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = TOKEN.exec(text)) !== null) {
        if (match.index > last) {
            fragment.append(text.slice(last, match.index));
        }
        const token = match[0];
        last = match.index + token.length;

        if (token.startsWith('**') || token.startsWith('__')) {
            const el = document.createElement('strong');
            el.append(renderInline(token.slice(2, -2)));
            fragment.append(el);
        } else if (token.startsWith('~~')) {
            const el = document.createElement('s');
            el.append(renderInline(token.slice(2, -2)));
            fragment.append(el);
        } else if (token.startsWith('`')) {
            const el = document.createElement('code');
            el.textContent = token.slice(1, -1);
            fragment.append(el);
        } else if (token.startsWith('[[')) {
            const el = document.createElement('span');
            el.className = 'cm-md-wikilink';
            el.textContent = token.slice(2, -2);
            fragment.append(el);
        } else if (token.startsWith('[')) {
            const parsed = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
            if (parsed && isSafeLinkUrl(parsed[2])) {
                const el = document.createElement('a');
                el.href = parsed[2];
                el.target = '_blank';
                el.rel = 'noopener noreferrer';
                el.textContent = parsed[1];
                fragment.append(el);
            } else {
                fragment.append(token);
            }
        } else {
            const el = document.createElement('em');
            el.append(renderInline(token.slice(1, -1)));
            fragment.append(el);
        }
    }
    if (last < text.length) {
        fragment.append(text.slice(last));
    }
    return fragment;
}
