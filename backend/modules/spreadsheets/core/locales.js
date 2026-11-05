'use strict';

const fs = require('fs');
const path = require('path');

// The app's translation catalogs, read straight from disk: column headers
// and status labels are matched in every language, so a sheet exported in
// Greek imports back for someone using English. Production copies the
// catalogs to backend/dist/locales, development reads public/locales.
const CANDIDATE_DIRS = [
    path.join(__dirname, '../../../dist/locales'),
    path.join(__dirname, '../../../../public/locales'),
];

let catalogs = null;

function localesDir() {
    return CANDIDATE_DIRS.find((dir) => fs.existsSync(dir)) || null;
}

function loadCatalogs() {
    if (catalogs) return catalogs;
    catalogs = {};
    const dir = localesDir();
    if (!dir) return catalogs;
    for (const code of fs.readdirSync(dir)) {
        const file = path.join(dir, code, 'translation.json');
        try {
            catalogs[code] = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            // A language without a readable catalog just adds no labels.
        }
    }
    return catalogs;
}

function lookup(catalog, key) {
    return key
        .split('.')
        .reduce(
            (node, part) =>
                node && typeof node === 'object' ? node[part] : undefined,
            catalog
        );
}

// The value of `key` in one language, falling back to English.
function translate(language, key) {
    const all = loadCatalogs();
    const value =
        lookup(all[language] || {}, key) ?? lookup(all.en || {}, key) ?? null;
    return typeof value === 'string' ? value : null;
}

// Every language's value of `key`, for matching what a sheet says.
function allTranslations(key) {
    const all = loadCatalogs();
    const values = [];
    for (const catalog of Object.values(all)) {
        const value = lookup(catalog, key);
        if (typeof value === 'string' && value.trim()) values.push(value);
    }
    return values;
}

module.exports = { translate, allTranslations };
