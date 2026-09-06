const fs = require('fs');
const path = require('path');

// Translation catalogs for the marketing page. Small and dependency-free on
// purpose: the page is the only server-rendered surface, so the app's
// i18next stack would be three dependencies for one template. What it does
// share with the app is the file layout, locales/<code>/landing.json with
// {{name}} placeholders, which is what linguaisync reads.
//
// Codes are BCP-47, so Japanese is 'ja' and Ukrainian is 'uk'. The app's
// catalogs use 'jp' and 'ua' for the same two languages; these codes become
// public URLs and hreflang values, and Google ignores an hreflang it cannot
// parse, so the two lists are kept separate deliberately.

const DEFAULT_LOCALE = 'en';
const LANG_COOKIE = 'tududi_lang';
const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

const LOCALES = [
    {
        code: 'en',
        englishName: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        htmlLang: 'en',
        ogLocale: 'en_US',
    },
    {
        code: 'ar',
        englishName: 'Arabic',
        nativeName: 'العربية',
        flag: '🇸🇦',
        htmlLang: 'ar',
        ogLocale: 'ar_SA',
        dir: 'rtl',
    },
    {
        code: 'bg',
        englishName: 'Bulgarian',
        nativeName: 'Български',
        flag: '🇧🇬',
        htmlLang: 'bg',
        ogLocale: 'bg_BG',
    },
    {
        code: 'da',
        englishName: 'Danish',
        nativeName: 'Dansk',
        flag: '🇩🇰',
        htmlLang: 'da',
        ogLocale: 'da_DK',
    },
    {
        code: 'de',
        englishName: 'German',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        htmlLang: 'de',
        ogLocale: 'de_DE',
    },
    {
        code: 'el',
        englishName: 'Greek',
        nativeName: 'Ελληνικά',
        flag: '🇬🇷',
        htmlLang: 'el',
        ogLocale: 'el_GR',
    },
    {
        code: 'es',
        englishName: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        htmlLang: 'es',
        ogLocale: 'es_ES',
    },
    {
        code: 'fi',
        englishName: 'Finnish',
        nativeName: 'Suomi',
        flag: '🇫🇮',
        htmlLang: 'fi',
        ogLocale: 'fi_FI',
    },
    {
        code: 'fr',
        englishName: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
        htmlLang: 'fr',
        ogLocale: 'fr_FR',
    },
    {
        code: 'id',
        englishName: 'Indonesian',
        nativeName: 'Bahasa Indonesia',
        flag: '🇮🇩',
        htmlLang: 'id',
        ogLocale: 'id_ID',
    },
    {
        code: 'it',
        englishName: 'Italian',
        nativeName: 'Italiano',
        flag: '🇮🇹',
        htmlLang: 'it',
        ogLocale: 'it_IT',
    },
    {
        code: 'ja',
        englishName: 'Japanese',
        nativeName: '日本語',
        flag: '🇯🇵',
        htmlLang: 'ja',
        ogLocale: 'ja_JP',
    },
    {
        code: 'ko',
        englishName: 'Korean',
        nativeName: '한국어',
        flag: '🇰🇷',
        htmlLang: 'ko',
        ogLocale: 'ko_KR',
    },
    {
        code: 'nl',
        englishName: 'Dutch',
        nativeName: 'Nederlands',
        flag: '🇳🇱',
        htmlLang: 'nl',
        ogLocale: 'nl_NL',
    },
    {
        code: 'no',
        englishName: 'Norwegian',
        nativeName: 'Norsk',
        flag: '🇳🇴',
        htmlLang: 'no',
        ogLocale: 'nb_NO',
    },
    {
        code: 'pl',
        englishName: 'Polish',
        nativeName: 'Polski',
        flag: '🇵🇱',
        htmlLang: 'pl',
        ogLocale: 'pl_PL',
    },
    {
        code: 'pt',
        englishName: 'Portuguese',
        nativeName: 'Português',
        flag: '🇵🇹',
        htmlLang: 'pt',
        ogLocale: 'pt_PT',
    },
    {
        code: 'ro',
        englishName: 'Romanian',
        nativeName: 'Română',
        flag: '🇷🇴',
        htmlLang: 'ro',
        ogLocale: 'ro_RO',
    },
    {
        code: 'ru',
        englishName: 'Russian',
        nativeName: 'Русский',
        flag: '🇷🇺',
        htmlLang: 'ru',
        ogLocale: 'ru_RU',
    },
    {
        code: 'sl',
        englishName: 'Slovenian',
        nativeName: 'Slovenščina',
        flag: '🇸🇮',
        htmlLang: 'sl',
        ogLocale: 'sl_SI',
    },
    {
        code: 'sv',
        englishName: 'Swedish',
        nativeName: 'Svenska',
        flag: '🇸🇪',
        htmlLang: 'sv',
        ogLocale: 'sv_SE',
    },
    {
        code: 'tr',
        englishName: 'Turkish',
        nativeName: 'Türkçe',
        flag: '🇹🇷',
        htmlLang: 'tr',
        ogLocale: 'tr_TR',
    },
    {
        code: 'uk',
        englishName: 'Ukrainian',
        nativeName: 'Українська',
        flag: '🇺🇦',
        htmlLang: 'uk',
        ogLocale: 'uk_UA',
    },
    {
        code: 'vi',
        englishName: 'Vietnamese',
        nativeName: 'Tiếng Việt',
        flag: '🇻🇳',
        htmlLang: 'vi',
        ogLocale: 'vi_VN',
    },
    {
        code: 'zh',
        englishName: 'Chinese',
        nativeName: '中文',
        flag: '🇨🇳',
        htmlLang: 'zh',
        ogLocale: 'zh_CN',
    },
];

const LOCALE_CODES = LOCALES.map((l) => l.code);

const LOCALES_DIR = path.join(__dirname, 'locales');
const CATALOG_FILE = 'landing.json';

const catalogs = new Map();
const warned = new Set();

function isSupportedLocale(value) {
    return typeof value === 'string' && LOCALE_CODES.includes(value);
}

function localeMeta(code) {
    return LOCALES.find((l) => l.code === code) || LOCALES[0];
}

function readCatalog(locale) {
    const file = path.join(LOCALES_DIR, locale, CATALOG_FILE);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getCatalog(locale) {
    const cached = catalogs.get(locale);
    if (cached) return cached;
    const loaded = readCatalog(locale);
    catalogs.set(locale, loaded);
    return loaded;
}

function flattenKeys(node, prefix = '') {
    return Object.entries(node).flatMap(([key, value]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        return value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
            ? flattenKeys(value, full)
            : [full];
    });
}

// Loads and validates every catalog before the server accepts traffic. A
// malformed locale file fails the boot rather than serving a homepage full
// of dotted keys. Returns the per-locale list of keys missing against
// English so a caller can log them.
function preloadCatalogs() {
    const base = readCatalog(DEFAULT_LOCALE);
    const baseKeys = flattenKeys(base);
    if (baseKeys.length === 0) {
        throw new Error(
            `landing: base catalog ${DEFAULT_LOCALE}/${CATALOG_FILE} is empty`
        );
    }
    const missing = {};
    LOCALE_CODES.forEach((code) => {
        const catalog = readCatalog(code);
        catalogs.set(code, catalog);
        const present = new Set(flattenKeys(catalog));
        const absent = baseKeys.filter((k) => !present.has(k));
        if (absent.length) missing[code] = absent;
    });
    return missing;
}

function lookup(node, key) {
    return key.split('.').reduce((acc, part) => {
        if (acc === undefined || typeof acc !== 'object' || Array.isArray(acc))
            return undefined;
        return acc[part];
    }, node);
}

// linguaisync placeholder syntax: {{name}}. Unknown names stay in place so a
// typo shows up as a literal {{foo}} rather than as the word "undefined".
function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(vars, name)
            ? String(vars[name])
            : whole
    );
}

function warnOnce(locale, key, what) {
    const id = `${locale}:${key}`;
    if (warned.has(id)) return;
    warned.add(id);
    console.warn(`landing i18n ${what}: ${id}`);
}

function createI18n(requested) {
    const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
    const primary = getCatalog(locale);
    const fallback =
        locale === DEFAULT_LOCALE ? primary : getCatalog(DEFAULT_LOCALE);

    function resolve(key) {
        const hit = lookup(primary, key);
        if (hit !== undefined) return hit;
        if (primary !== fallback) {
            const alt = lookup(fallback, key);
            if (alt !== undefined) {
                warnOnce(locale, key, `missing key, using ${DEFAULT_LOCALE}`);
                return alt;
            }
        }
        return undefined;
    }

    function t(key, vars) {
        const value = resolve(key);
        if (typeof value === 'string') return interpolate(value, vars);
        // The key itself is the last resort, on purpose: an empty string
        // would hide the bug until someone screenshotted the French page.
        warnOnce(
            locale,
            key,
            value === undefined ? 'unknown key' : 'key is not a string'
        );
        return key;
    }

    function tList(key, vars) {
        const value = resolve(key);
        if (Array.isArray(value))
            return value.map((entry) => interpolate(String(entry), vars));
        warnOnce(locale, key, 'expected an array');
        return [];
    }

    // Flat { leaf: string } for one subtree, used for the window.__I18N blob.
    function tGroup(prefix) {
        const node = resolve(prefix);
        if (
            node === undefined ||
            typeof node !== 'object' ||
            Array.isArray(node)
        )
            return {};
        return Object.fromEntries(
            Object.keys(node).map((leaf) => [leaf, t(`${prefix}.${leaf}`)])
        );
    }

    return {
        locale,
        meta: localeMeta(locale),
        isDefault: locale === DEFAULT_LOCALE,
        t,
        tList,
        tGroup,
    };
}

// Minimal cookie-header parser, so one value does not pull in cookie-parser.
function parseCookies(header) {
    if (!header) return {};
    return header.split(';').reduce((acc, pair) => {
        const eq = pair.indexOf('=');
        if (eq < 1) return acc;
        const name = pair.slice(0, eq).trim();
        if (!name) return acc;
        const raw = pair.slice(eq + 1).trim();
        try {
            acc[name] = decodeURIComponent(raw);
        } catch {
            acc[name] = raw;
        }
        return acc;
    }, {});
}

// '/' for the base language, '/fr' otherwise. Suffix appended verbatim.
function localePath(locale, suffix = '') {
    const base = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
    return `${base}${suffix}` || '/';
}

function makeLocaleUrl(siteOrigin) {
    const origin = siteOrigin.replace(/\/$/, '');
    return (locale) =>
        locale === DEFAULT_LOCALE ? `${origin}/` : `${origin}/${locale}`;
}

// JSON.stringify hardened for an inline <script>: without the '<' escape a
// translation containing "</script>" would end the block early.
function jsonForScript(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

module.exports = {
    DEFAULT_LOCALE,
    LANG_COOKIE,
    LANG_COOKIE_MAX_AGE,
    LOCALES,
    LOCALE_CODES,
    LOCALES_DIR,
    CATALOG_FILE,
    isSupportedLocale,
    localeMeta,
    flattenKeys,
    preloadCatalogs,
    createI18n,
    parseCookies,
    localePath,
    makeLocaleUrl,
    jsonForScript,
};
