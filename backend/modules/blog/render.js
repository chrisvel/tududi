'use strict';

const { Marked } = require('marked');

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;
const VIDEO_URL = /\.(mp4|webm)(?:[?#]|$)/i;
// Web, mail and same-site addresses only; javascript:, data: and the rest
// render as plain text.
const SAFE_URL = /^(https?:|mailto:|\/|#|\.|[^:/?#]+(?:[/?#]|$))/i;

const safeUrl = (href) => {
    const url = String(href || '').trim();
    return url && SAFE_URL.test(url) ? url : null;
};

// Markdown to HTML for crawlers and readers without scripts. The browser app
// replaces it on load, so it only has to carry the text and links. Raw HTML
// in a note is shown as text, as the app's Markdown view does.
const marked = new Marked({
    gfm: true,
    renderer: {
        html({ text }) {
            return escapeHtml(text);
        },
        link({ href, title, tokens }) {
            const text = this.parser.parseInline(tokens);
            const url = safeUrl(href);
            if (!url) return text;
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            return `<a href="${escapeHtml(url)}"${titleAttr}>${text}</a>`;
        },
        image({ href, text }) {
            const url = safeUrl(href);
            if (!url) return escapeHtml(text);
            if (VIDEO_URL.test(url)) {
                return `<video src="${escapeHtml(url)}" controls></video>`;
            }
            return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}">`;
        },
    },
});

// [[Title]] becomes a link to the post with that title, or plain text when
// the blog has no such post.
function renderMarkdown(content, pathFor) {
    const linked = (content || '').replace(WIKILINK, (_, title) => {
        const path = pathFor(title);
        const label = title.replace(/[[\]\\]/g, '\\$&');
        return path ? `[${label}](${path})` : label;
    });
    return marked.parse(linked);
}

module.exports = { escapeHtml, renderMarkdown };
