'use strict';

const dns = require('dns');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const { getConfig } = require('../config/config');

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

// Domains reserved for documentation and testing (RFC 2606, RFC 6761), plus
// .local (RFC 6762). Nobody real owns a mailbox on any of them, so a form
// filled with example@example.com is a test or a bot, never a signup.
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];
const RESERVED_TLDS = new Set([
    'example',
    'invalid',
    'localhost',
    'test',
    'local',
]);

const domainOf = (email) => email.slice(email.lastIndexOf('@') + 1);

const isReservedDomain = (domain) =>
    RESERVED_TLDS.has(domain.split('.').pop()) ||
    RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

const isValidEmail = (email) =>
    email.length <= MAX_EMAIL_LENGTH &&
    EMAIL_SHAPE.test(email) &&
    !isReservedDomain(domainOf(email));

// Short timeout and a single try: the visitor is waiting on the redirect, and
// a slow resolver is not worth a slow page.
const resolver = new dns.promises.Resolver({ timeout: 2000, tries: 1 });

// These mean the name is definitively not there (or has no such record). Any
// other error is DNS itself misbehaving, which says nothing about the address.
const NO_RECORD_CODES = new Set(['ENOTFOUND', 'ENODATA']);

async function hasAddressRecord(domain) {
    for (const lookup of ['resolve4', 'resolve6']) {
        try {
            const records = await resolver[lookup](domain);
            if (records.length > 0) return true;
        } catch (error) {
            if (!NO_RECORD_CODES.has(error.code)) throw error;
        }
    }
    return false;
}

// Whether mail to this domain could be delivered. A domain with no MX record
// still takes mail at its A/AAAA address (RFC 5321), and a null MX ("0 .",
// RFC 7505, which example.com publishes) says it takes none. Only a definite
// "no" returns false: a timeout or a SERVFAIL fails open, because losing a
// real signup to a flaky resolver is worse than keeping a dud row.
async function acceptsMail(domain) {
    try {
        const records = await resolver.resolveMx(domain);
        return records.some((r) => r.exchange && r.exchange !== '.');
    } catch (error) {
        if (!NO_RECORD_CODES.has(error.code)) return true;
    }
    try {
        return await hasAddressRecord(domain);
    } catch (error) {
        return true;
    }
}

// Never throws: a capture failure must not show a stranger a stack trace,
// and it must not lose the page they were on either.
async function capture({
    email,
    source = 'unknown',
    locale = null,
    referrer,
    ip = null,
}) {
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) return { accepted: false, created: false };
    if (
        getConfig().waitlist.mxCheck &&
        !(await acceptsMail(domainOf(address)))
    ) {
        return { accepted: false, created: false };
    }

    try {
        const { WaitlistSubscriber } = require('../models');
        const ipAddress = ip ? String(ip).slice(0, 45) : null;
        const [row, created] = await WaitlistSubscriber.findOrCreate({
            where: { email: address },
            // Sliced to the column widths: these arrive from a form, and a
            // long value would be a write error rather than a lost row.
            defaults: {
                email: address,
                source: String(source || 'unknown').slice(0, 32),
                locale: locale ? String(locale).slice(0, 8) : null,
                referrer: referrer ? String(referrer).slice(0, 512) : null,
                ip_address: ipAddress,
            },
        });
        // A second submission is not a second person; it is someone checking
        // the form worked.
        if (!created) {
            await row.increment('submission_count');
            await row.update({ ip_address: ipAddress });
        }
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
            ip_address: r.ip_address,
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
        ip_address: r.ip_address,
        submission_count: r.submission_count,
        created_at: r.created_at,
    }));
}

// Removing a row is permanent: someone asked to be forgotten, or a bad
// address was never going to be mailed anyway. Returns whether a row was
// actually there to remove.
async function remove(id) {
    const { WaitlistSubscriber } = require('../models');
    const destroyed = await WaitlistSubscriber.destroy({ where: { id } });
    return destroyed > 0;
}

// RFC 4180: quote every field and double the quotes inside it, so an address
// or a locale can never break the row apart.
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function toCsv(rows) {
    const header = [
        'email',
        'source',
        'locale',
        'ip_address',
        'submissions',
        'joined_at',
    ];
    const lines = rows.map((r) =>
        [
            r.email,
            r.source,
            r.locale || '',
            r.ip_address || '',
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

module.exports = {
    capture,
    list,
    all,
    remove,
    toCsv,
    isValidEmail,
    acceptsMail,
    normalizeEmail,
};
