'use strict';

const { Op } = require('sequelize');
const { logError } = require('./logService');

// People who asked to be told when Cloud opens. Three doors lead here: the
// marketing page's forms, the pricing card while Cloud is shut, and the
// register page on the app host. They share this file so the "one address,
// one row" rule is written once.

const MAX_EMAIL_LENGTH = 254;

// Shape only. Anything past this is the mail provider's problem, and telling
// a visitor their address looks wrong is worse than keeping a dud row.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalizeEmail = (value) =>
    String(value || '')
        .trim()
        .toLowerCase();

const isValidEmail = (email) =>
    email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email);

// Never throws: a capture failure must not show a stranger a stack trace,
// and it must not lose the page they were on either.
async function capture({ email, source = 'unknown', locale = null, referrer }) {
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) return { accepted: false, created: false };

    try {
        const { WaitlistSubscriber } = require('../models');
        const [row, created] = await WaitlistSubscriber.findOrCreate({
            where: { email: address },
            // Sliced to the column widths: these arrive from a form, and a
            // long value would be a write error rather than a lost row.
            defaults: {
                email: address,
                source: String(source || 'unknown').slice(0, 32),
                locale: locale ? String(locale).slice(0, 8) : null,
                referrer: referrer ? String(referrer).slice(0, 512) : null,
            },
        });
        // A second submission is not a second person; it is someone checking
        // the form worked.
        if (!created) await row.increment('submission_count');
        return { accepted: true, created };
    } catch (error) {
        logError('Waitlist signup failed:', error);
        return { accepted: false, created: false };
    }
}

// Newest first, optionally narrowed by a fragment of the address. Emails are
// stored lowercased by the model, so a lowercased LIKE is dialect-safe.
async function list({ limit = 50, offset = 0, q = '' } = {}) {
    const { WaitlistSubscriber } = require('../models');
    const needle = normalizeEmail(q);
    const { rows, count } = await WaitlistSubscriber.findAndCountAll({
        where: needle ? { email: { [Op.like]: `%${needle}%` } } : undefined,
        order: [['created_at', 'DESC']],
        limit: Math.min(Math.max(Number(limit) || 50, 1), 500),
        offset: Math.max(Number(offset) || 0, 0),
    });
    return {
        total: count,
        subscribers: rows.map((r) => ({
            id: r.id,
            email: r.email,
            source: r.source,
            locale: r.locale,
            submission_count: r.submission_count,
            created_at: r.created_at,
        })),
    };
}

// Every row, for the export. No limit on purpose: the point of the export is
// to hand the whole list to a mail provider on launch day.
async function all() {
    const { WaitlistSubscriber } = require('../models');
    const rows = await WaitlistSubscriber.findAll({
        order: [['created_at', 'ASC']],
    });
    return rows.map((r) => ({
        email: r.email,
        source: r.source,
        locale: r.locale,
        submission_count: r.submission_count,
        created_at: r.created_at,
    }));
}

// RFC 4180: quote every field and double the quotes inside it, so an address
// or a locale can never break the row apart.
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function toCsv(rows) {
    const header = ['email', 'source', 'locale', 'submissions', 'joined_at'];
    const lines = rows.map((r) =>
        [
            r.email,
            r.source,
            r.locale || '',
            r.submission_count,
            r.created_at instanceof Date
                ? r.created_at.toISOString()
                : r.created_at,
        ]
            .map(csvCell)
            .join(',')
    );
    return [header.map(csvCell).join(','), ...lines].join('\r\n');
}

module.exports = { capture, list, all, toCsv, isValidEmail, normalizeEmail };
