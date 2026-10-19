#!/usr/bin/env node
'use strict';

// Writes every email in every language (or the languages given as
// arguments) to backend/emails/preview/ as HTML pages, with sample data,
// so the copy can be read without sending anything.

const fs = require('fs');
const path = require('path');
const { EMAILS, LANGUAGES, renderEmail } = require('../emails');
const { escapeHtml } = require('../emails/layout');

const OUT_DIR = path.join(__dirname, '..', 'emails', 'preview');
const DAY_MS = 24 * 60 * 60 * 1000;
const url = (p) => `https://app.tududi.com${p}`;

// One or more sample variants per email.
const SAMPLES = {
    verification: [
        {
            label: 'sign-up (Cloud, with trial)',
            vars: {
                url: url('/api/verify-email?token=sample'),
                expiryHours: 24,
                trialDays: 7,
            },
        },
        {
            label: 'reminder',
            vars: {
                url: url('/api/verify-email?token=sample'),
                expiryHours: 24,
                trialDays: 7,
                reminder: true,
            },
        },
    ],
    passwordReset: [
        {
            label: '',
            vars: {
                url: url('/reset-password?token=sample'),
                expiryMinutes: 60,
            },
        },
    ],
    memberInvite: [
        {
            label: '',
            vars: { url: url('/reset-password?token=sample'), expiryHours: 72 },
        },
    ],
    trialReminder: [
        {
            label: '3 days left',
            vars: {
                daysLeft: 3,
                endsOn: new Date(Date.now() + 3 * DAY_MS),
                readOnlyDays: 30,
                subscribeUrl: url('/subscription/new'),
            },
        },
        {
            label: 'last day, free tier',
            vars: {
                daysLeft: 1,
                endsOn: new Date(Date.now() + DAY_MS),
                readOnlyDays: null,
                subscribeUrl: url('/subscription/new'),
            },
        },
    ],
    emptyAccount: [
        {
            label: 'on a trial',
            vars: {
                url: url('/inbox'),
                trialEndsOn: new Date(Date.now() + 5 * DAY_MS),
            },
        },
    ],
    comeBack: [
        {
            label: 'subscribed',
            vars: { url: url('/today/plan') },
        },
    ],
    deletionWarning: [
        {
            label: '',
            vars: {
                deleteOn: new Date(Date.now() + 7 * DAY_MS),
                subscribeUrl: url('/subscription/new'),
                exportUrl: url('/backup'),
            },
        },
    ],
    notification: [
        {
            label: '',
            vars: {
                title: 'Task due soon',
                message: 'Your task "Book the dentist" is due tomorrow.',
            },
        },
    ],
    contactMessage: [
        {
            label: '',
            vars: {
                name: 'Sam',
                email: 'sam@example.com',
                ip: '203.0.113.7',
                message: 'Hello!',
            },
        },
    ],
};

const page = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;line-height:1.5}
.meta{background:#f3f4f6;padding:.75rem 1rem;border-radius:8px;margin-bottom:1.5rem}
pre{white-space:pre-wrap;background:#f9fafb;padding:1rem;border-radius:8px}</style>
</head><body>${body}</body></html>
`;

function main() {
    const wanted = process.argv.slice(2);
    const languages = wanted.length
        ? LANGUAGES.filter((l) => wanted.includes(l))
        : LANGUAGES;
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const links = [];
    for (const name of Object.keys(EMAILS)) {
        for (const [i, sample] of (SAMPLES[name] || []).entries()) {
            for (const language of languages) {
                const email = renderEmail(name, { language, ...sample.vars });
                const file = `${name}${i ? `-${i}` : ''}.${language}.html`;
                const label = [name, sample.label, language]
                    .filter(Boolean)
                    .join(' / ');
                const html =
                    email.html || `<pre>${escapeHtml(email.text)}</pre>`;
                fs.writeFileSync(
                    path.join(OUT_DIR, file),
                    page(
                        label,
                        `<div class="meta"><strong>Subject:</strong> ${escapeHtml(email.subject)}</div>${html}<h3>Plain text</h3><pre>${escapeHtml(email.text)}</pre>`
                    )
                );
                links.push(
                    `<li><a href="${file}">${escapeHtml(label)}</a></li>`
                );
            }
        }
    }
    fs.writeFileSync(
        path.join(OUT_DIR, 'index.html'),
        page(
            'Email previews',
            `<h1>Email previews</h1><ul>${links.join('')}</ul>`
        )
    );
    console.log(`Wrote ${links.length} previews to ${OUT_DIR}/index.html`);
}

main();
