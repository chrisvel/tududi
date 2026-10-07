'use strict';

const dns = require('dns');
const { disposableEmailBlocklist } = require('disposable-email-domains-js');

// Checks on the domain half of an address, shared by account registration
// and the Cloud waitlist so both turn away the same throwaway addresses.

const domainOf = (email) =>
    String(email || '')
        .slice(String(email || '').lastIndexOf('@') + 1)
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

const isReservedDomain = (domain) =>
    RESERVED_TLDS.has(domain.split('.').pop()) ||
    RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

// Built on first use: the list is a few thousand names and most processes
// never see a signup.
let disposableDomains = null;

// A subdomain of a listed provider (x.mailinator.com) is the same mailbox
// service, so every parent of the domain is checked too.
const isDisposableDomain = (domain) => {
    if (!disposableDomains) {
        disposableDomains = new Set(disposableEmailBlocklist());
    }
    const labels = domain.split('.');
    for (let i = 0; i < labels.length - 1; i++) {
        if (disposableDomains.has(labels.slice(i).join('.'))) return true;
    }
    return false;
};

// Short timeout and a single try: the visitor is waiting on the response,
// and a slow resolver is not worth a slow page.
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

// Gmail ignores dots in the local part, and googlemail.com is the same
// mailbox under its older name.
const DOTLESS_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

// One spelling per mailbox: lowercased, without a "+tag" (which nearly every
// provider delivers to the same inbox), and for Gmail without dots. Two
// addresses with the same canonical form reach the same person.
const canonicalEmail = (email) => {
    const value = String(email || '')
        .trim()
        .toLowerCase();
    const at = value.lastIndexOf('@');
    if (at <= 0) return value || null;

    let local = value.slice(0, at);
    let domain = value.slice(at + 1);
    const plus = local.indexOf('+');
    if (plus > 0) local = local.slice(0, plus);
    if (DOTLESS_DOMAINS.has(domain)) {
        local = local.replace(/\./g, '');
        domain = 'gmail.com';
    }
    return `${local}@${domain}`;
};

module.exports = {
    canonicalEmail,
    domainOf,
    isReservedDomain,
    isDisposableDomain,
    acceptsMail,
};
