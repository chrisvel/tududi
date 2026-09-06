#!/usr/bin/env node
// Key and placeholder parity for the marketing page catalogs
// (backend/modules/landing/locales/<code>/landing.json).
//
// Catches two silent failures: a key added to English and nowhere else, which
// renders as English on every other page, and a translation that dropped or
// "translated" a {{placeholder}}, which renders literal braces to a visitor.
// Exits non-zero on any mismatch. Run with: node scripts/landing-i18n-check.js

const fs = require('fs');
const path = require('path');
const {
    LOCALE_CODES,
    DEFAULT_LOCALE,
    LOCALES_DIR,
    CATALOG_FILE,
    flattenKeys,
} = require('../modules/landing/i18n');

function load(locale) {
    const file = path.join(LOCALES_DIR, locale, CATALOG_FILE);
    try {
        return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (err) {
        return {
            ok: false,
            why:
                err.code === 'ENOENT'
                    ? 'file missing'
                    : `unreadable: ${err.message}`,
        };
    }
}

// Every leaf as a string, so array entries are compared too
function leaves(node, prefix = '') {
    const out = new Map();
    Object.entries(node).forEach(([key, value]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        if (Array.isArray(value)) {
            value.forEach((entry, i) =>
                out.set(`${full}[${i}]`, String(entry))
            );
        } else if (value !== null && typeof value === 'object') {
            leaves(value, full).forEach((v, k) => out.set(k, v));
        } else {
            out.set(full, String(value));
        }
    });
    return out;
}

function placeholders(value) {
    return (value.match(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g) || []).sort().join(',');
}

const baseLoad = load(DEFAULT_LOCALE);
if (!baseLoad.ok) {
    console.error(
        `base catalog ${DEFAULT_LOCALE}/${CATALOG_FILE} ${baseLoad.why}`
    );
    process.exit(1);
}
const baseKeys = new Set(flattenKeys(baseLoad.data));
const baseLeaves = leaves(baseLoad.data);

let problems = 0;
for (const code of LOCALE_CODES) {
    if (code === DEFAULT_LOCALE) continue;
    const loaded = load(code);
    if (!loaded.ok) {
        console.error(`${code}: ${loaded.why}`);
        problems += 1;
        continue;
    }
    const keys = new Set(flattenKeys(loaded.data));
    const missing = [...baseKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !baseKeys.has(k));
    const drift = [];
    leaves(loaded.data).forEach((value, key) => {
        const base = baseLeaves.get(key);
        if (base !== undefined && placeholders(base) !== placeholders(value)) {
            drift.push(key);
        }
    });
    if (missing.length || extra.length || drift.length) {
        problems += 1;
        console.error(`${code}:`);
        if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
        if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
        if (drift.length)
            console.error(`  placeholders differ: ${drift.join(', ')}`);
    }
}

if (problems) {
    console.error(`${problems} locale(s) out of sync with ${DEFAULT_LOCALE}`);
    process.exit(1);
}
console.log(`${LOCALE_CODES.length} landing catalogs in sync`);
