'use strict';

// Every email is a list of blocks, turned into a plain-text body and a
// matching HTML body here, so the look lives in one place:
//   { p: 'text' }               a paragraph
//   { p: 'text', strong: true } a paragraph in bold
//   { button: label, url }      a button (in text: the link on its own line)
//   { link: url }               a link shown in full, to copy by hand
//   { list: ['a', 'b'] }        a bulleted list

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const BUTTON_STYLE =
    'background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;';

function blockText(block) {
    if (block.button) return block.url;
    if (block.link) return block.link;
    if (block.list) return block.list.map((item) => `- ${item}`).join('\n');
    return block.p;
}

function blockHtml(block) {
    if (block.button) {
        return `<p style="text-align: center; margin: 30px 0;">
    <a href="${escapeHtml(block.url)}" style="${BUTTON_STYLE}">${escapeHtml(block.button)}</a>
</p>`;
    }
    if (block.link) {
        return `<p style="word-break: break-all; color: #666;">${escapeHtml(block.link)}</p>`;
    }
    if (block.list) {
        const items = block.list
            .map((item) => `    <li>${escapeHtml(item)}</li>`)
            .join('\n');
        return `<ul>\n${items}\n</ul>`;
    }
    const text = escapeHtml(block.p).replace(/\n/g, '<br>');
    return `<p>${block.strong ? `<strong>${text}</strong>` : text}</p>`;
}

// `signoff` is the closing lines ("Best regards,\nThe Tududi Team"), or
// null for an email that has none.
function render({ subject, blocks, signoff, dir = 'ltr' }) {
    const all = signoff ? [...blocks, { p: signoff }] : blocks;
    const text = all.map(blockText).join('\n\n');
    const body = all.map(blockHtml).join('\n\n');
    const html =
        dir === 'rtl' ? `<div dir="rtl">\n${body}\n</div>` : `\n${body}\n`;
    return { subject, text, html };
}

module.exports = { render, escapeHtml };
