'use strict';

const fs = require('fs');
const path = require('path');

// Translation catalogs for the emails tududi sends. Codes are the app's own
// (users.language), so Japanese is 'jp' and Ukrainian is 'ua', unlike the
// landing pages. Plurals follow i18next: `key_one`, `key_few`, `key_other`
// and so on, picked by Intl.PluralRules from `count`.

const DEFAULT_LANGUAGE = 'en';
const LOCALES_DIR = path.join(__dirname, 'locales');
const CATALOG_FILE = 'emails.json';

// Where an app code is not a BCP-47 tag, for Intl.
const INTL_TAGS = { jp: 'ja', ua: 'uk' };

const LANGUAGES = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const catalogs = new Map();

function getCatalog(language) {
    if (!catalogs.has(language)) {
        const file = path.join(LOCALES_DIR, language, CATALOG_FILE);
        catalogs.set(language, JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    return catalogs.get(language);
}

// 'pt-BR' and 'PT' both mean 'pt'; anything unknown is English.
function normalizeLanguage(value) {
    const code = String(value || '')
        .toLowerCase()
        .split(/[-_]/)[0];
    return LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}

const intlTag = (language) => INTL_TAGS[language] || language;

function lookup(catalog, key) {
    return key
        .split('.')
        .reduce(
            (node, part) =>
                node && typeof node === 'object' ? node[part] : undefined,
            catalog
        );
}

// {{name}} placeholders, as in the app and landing catalogs.
function interpolate(template, vars = {}) {
    return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(vars, name)
            ? String(vars[name])
            : whole
    );
}

function createTranslator(requested) {
    const language = normalizeLanguage(requested);
    const order = [getCatalog(language), getCatalog(DEFAULT_LANGUAGE)];
    const plurals = new Intl.PluralRules(intlTag(language));

    function resolve(key, vars) {
        const candidates =
            vars && typeof vars.count === 'number'
                ? [`${key}_${plurals.select(vars.count)}`, `${key}_other`, key]
                : [key];
        for (const catalog of order) {
            for (const candidate of candidates) {
                const value = lookup(catalog, candidate);
                if (value !== undefined) return value;
            }
        }
        return undefined;
    }

    function t(key, vars) {
        const value = resolve(key, vars);
        if (typeof value === 'string') return interpolate(value, vars);
        if (Array.isArray(value)) {
            return value.map((item) => interpolate(item, vars));
        }
        // A missing key shows as itself, so it is noticed rather than sent
        // as an empty line.
        return key;
    }

    const formatDate = (date) =>
        new Date(date).toLocaleDateString(intlTag(language), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });

    return { language, t, formatDate, dir: language === 'ar' ? 'rtl' : 'ltr' };
}

module.exports = {
    DEFAULT_LANGUAGE,
    LANGUAGES,
    LOCALES_DIR,
    CATALOG_FILE,
    normalizeLanguage,
    createTranslator,
};
