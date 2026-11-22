'use strict';

// Language-specific pieces of inbox natural-language parsing: which chrono
// parser reads dates in the user's language, the words that only introduce
// a due date, and the recurrence phrases. English lives in nlpParsers.js and
// is always tried as well, so English input keeps working in every language.

const chrono = require('chrono-node');

// "20.11." with no year, which chrono only reads when the year follows.
const dottedShortDateParser = {
    pattern: () => /(\d{1,2})\.(\d{1,2})\.(?!\d)/,
    extract: (context, match) => {
        const before = context.text.charAt(match.index - 1);
        if (before && !/\s/.test(before)) return null;
        const day = Number(match[1]);
        const month = Number(match[2]);
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        return context.createParsingComponents({ day, month });
    },
};

const withDottedShortDates = (base) => {
    const custom = base.clone();
    custom.parsers.push(dottedShortDateParser);
    return custom;
};

const DATE_PARSERS = {
    de: withDottedShortDates(chrono.de.casual),
    es: chrono.es.casual,
    fi: withDottedShortDates(chrono.fi.casual),
    fr: chrono.fr.casual,
    it: chrono.it.casual,
    ja: chrono.ja.casual,
    nl: chrono.nl.casual,
    pt: chrono.pt.casual,
    ru: chrono.ru.casual,
    sv: chrono.sv.casual,
    uk: chrono.uk.casual,
    vi: chrono.vi.casual,
    zh: chrono.zh.casual,
};

// Codes the app uses that differ from the language code.
const LANGUAGE_ALIASES = { jp: 'ja', ua: 'uk' };

const normalizeLanguage = (language) => {
    if (typeof language !== 'string') return null;
    const code = language.trim().toLowerCase().split(/[-_]/)[0];
    return LANGUAGE_ALIASES[code] || code || null;
};

const dateParserFor = (language) =>
    DATE_PARSERS[normalizeLanguage(language)] || null;

// A word for "tomorrow" that also means "morning". After these words it is
// the morning: "Guten Morgen", "por la mañana", "in de morgen".
const MORNING_WORDS = {
    de: {
        word: /^Morgen$/,
        before: /(?:^|\s)(?:guten|am|jeden|den|dem|der|des|einen|einem|eines|diesen|frühen|vom)\s+$/i,
    },
    es: {
        word: /^mañana$/i,
        before: /(?:^|\s)(?:la|esta|cada|una|buena|toda)\s+$/i,
    },
    nl: {
        word: /^morgen$/i,
        before: /(?:^|\s)(?:goede|de|elke|iedere|deze)\s+$/i,
    },
};

const LETTER = /[\p{Script=Latin}\p{Script=Cyrillic}]/u;
const SHORT_WORD = /^[\p{Script=Latin}\p{Script=Cyrillic}]{1,3}\.?$/u;

// chrono's locale parsers read two and three letter weekday short forms
// ("so", "do", "mar", "jeu") and match them inside longer words ("fr" in
// "früh"). Those are nearly always plain words, so they are not dates here.
const isLocalizedDateNoise = (language, text, result) => {
    const phrase = result.text.trim();
    if (SHORT_WORD.test(phrase)) return true;

    const before = text.charAt(result.index - 1);
    const after = text.charAt(result.index + result.text.length);
    if (LETTER.test(phrase.charAt(0)) && before && LETTER.test(before)) {
        return true;
    }
    if (LETTER.test(phrase.slice(-1)) && after && LETTER.test(after)) {
        return true;
    }

    const morning = MORNING_WORDS[normalizeLanguage(language)];
    return Boolean(
        morning &&
        morning.word.test(phrase) &&
        morning.before.test(text.slice(0, result.index))
    );
};

// Words that only introduce a due date, cut from the title with the date.
const DATE_LEAD_PATTERNS = {
    de: /(^|\s)((?:fällig\s+(?:bis|vor)|fällig|bis\s+spätestens|spätestens\s+bis|spätestens|bis\s+zum|bis|vor)\s+)$/i,
};

const dateLeadPatternFor = (language) =>
    DATE_LEAD_PATTERNS[normalizeLanguage(language)] || null;

// \b only knows ASCII letters, so words with umlauts need their own edges.
const phrase = (source) =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');

const DE_WEEKDAYS = {
    sonntag: 0,
    so: 0,
    montag: 1,
    mo: 1,
    dienstag: 2,
    di: 2,
    mittwoch: 3,
    mi: 3,
    donnerstag: 4,
    do: 4,
    freitag: 5,
    fr: 5,
    samstag: 6,
    sonnabend: 6,
    sa: 6,
};
const DE_WEEKDAY =
    '(?:sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|so|mo|di|mi|do|fr|sa)';
// "montags" on its own already means every Monday.
const DE_WEEKDAY_ADVERB =
    '(?:sonntags|montags|dienstags|mittwochs|donnerstags|freitags|samstags|sonnabends)';
const DE_LIST_SEPARATOR = '\\s*(?:,|und|&)\\s*';
const DE_EVERY = 'jede[nsmr]?';
const DE_ORDINALS = {
    ersten: 1,
    erste: 1,
    '1.': 1,
    zweiten: 2,
    zweite: 2,
    '2.': 2,
    dritten: 3,
    dritte: 3,
    '3.': 3,
    vierten: 4,
    vierte: 4,
    '4.': 4,
    letzten: 5,
    letzte: 5,
};
const DE_ORDINAL = '(?:ersten?|zweiten?|dritten?|vierten?|letzten?|[1-4]\\.)';
const DE_NUMBERS = {
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
};
const DE_NUMBER = `(?:\\d{1,3}|${Object.keys(DE_NUMBERS).join('|')})`;
const DE_UNITS = {
    tag: 'daily',
    tage: 'daily',
    tagen: 'daily',
    woche: 'weekly',
    wochen: 'weekly',
    monat: 'monthly',
    monate: 'monthly',
    monaten: 'monthly',
    täglich: 'daily',
    wöchentlich: 'weekly',
    monatlich: 'monthly',
};

const deUnit = (unit, interval) => ({
    recurrence_type: DE_UNITS[unit.toLowerCase()],
    recurrence_interval: interval,
});

const deWeekdays = (list) => {
    const days = list
        .toLowerCase()
        .split(new RegExp(DE_LIST_SEPARATOR))
        .map((word) => DE_WEEKDAYS[word.trim().replace(/s$/, '')])
        .filter((day) => day !== undefined);
    return [...new Set(days)].sort((a, b) => a - b);
};

const weekly = (weekdays) =>
    weekdays.length === 0
        ? null
        : {
              recurrence_type: 'weekly',
              recurrence_interval: 1,
              recurrence_weekdays: weekdays,
          };

const monthlyOn = (day) =>
    day < 1 || day > 31
        ? null
        : {
              recurrence_type: 'monthly',
              recurrence_interval: 1,
              recurrence_month_day: day,
          };

// Ordered most specific first; the first rule that matches wins.
const DE_RECURRENCE_RULES = [
    {
        // "jeden ersten Montag", "jeden 2. Freitag im Monat"
        pattern: phrase(
            `${DE_EVERY}\\s+(${DE_ORDINAL})\\s+(${DE_WEEKDAY})(?:\\s+(?:im\\s+monat|des\\s+monats))?`
        ),
        build: (m) => ({
            recurrence_type: 'monthly_weekday',
            recurrence_interval: 1,
            recurrence_weekday: DE_WEEKDAYS[m[2].toLowerCase()],
            recurrence_week_of_month: DE_ORDINALS[m[1].toLowerCase()],
        }),
    },
    {
        // "jeden Monatsletzten", "jeden letzten Tag im Monat"
        pattern: phrase(
            `${DE_EVERY}\\s+(?:monatsletzten|letzten\\s+tag(?:\\s+(?:im\\s+monat|des\\s+monats))?)`
        ),
        build: () => ({
            recurrence_type: 'monthly_last_day',
            recurrence_interval: 1,
        }),
    },
    {
        // "alle 2 Wochen", "alle drei Tage"
        pattern: phrase(`alle\\s+(${DE_NUMBER})\\s+(tagen?|wochen|monaten?)`),
        build: (m) => {
            const interval = DE_NUMBERS[m[1].toLowerCase()] || Number(m[1]);
            return interval < 1 ? null : deUnit(m[2], interval);
        },
    },
    {
        // "jeden zweiten Tag", "jede 2. Woche"
        pattern: phrase(
            `${DE_EVERY}\\s+(zweiten?|dritten?|vierten?|[2-9]\\.)\\s+(tag|woche|monat)`
        ),
        build: (m) =>
            deUnit(
                m[2],
                DE_ORDINALS[m[1].toLowerCase()] || Number(m[1].slice(0, -1))
            ),
    },
    {
        // "jeden Monat am 15.", "monatlich am 15.", "jeden 15."
        pattern: phrase(
            `(?:${DE_EVERY}\\s+monat|monatlich)\\s+am\\s+(\\d{1,2})\\.?|${DE_EVERY}\\s+(\\d{1,2})\\.(?:\\s+(?:im\\s+monat|des\\s+monats))?`
        ),
        build: (m) => monthlyOn(Number(m[1] || m[2])),
    },
    {
        pattern: phrase(
            `werktags|wochentags|${DE_EVERY}\\s+(?:werktag|wochentag)|an\\s+(?:werktagen|wochentagen)`
        ),
        build: () => weekly([1, 2, 3, 4, 5]),
    },
    {
        // "jeden Montag", "jeden Montag und Mittwoch"
        pattern: phrase(
            `${DE_EVERY}\\s+(${DE_WEEKDAY}(?:${DE_LIST_SEPARATOR}${DE_WEEKDAY})*)`
        ),
        build: (m) => weekly(deWeekdays(m[1])),
    },
    {
        // "montags", "dienstags und donnerstags"
        pattern: phrase(
            `(${DE_WEEKDAY_ADVERB}(?:${DE_LIST_SEPARATOR}${DE_WEEKDAY_ADVERB})*)`
        ),
        build: (m) => weekly(deWeekdays(m[1])),
    },
    {
        pattern: phrase(`${DE_EVERY}\\s+(tag|woche|monat)`),
        build: (m) => deUnit(m[1], 1),
    },
    {
        // Only as the first or last word: there it is "täglich gießen", and
        // an adjective inside a title is inflected ("wöchentlicher Bericht").
        pattern:
            /^\s*(täglich|wöchentlich|monatlich)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(täglich|wöchentlich|monatlich)[.!]?\s*$/iu,
        build: (m) => deUnit(m[1] || m[2], 1),
    },
];

const RECURRENCE_RULES = { de: DE_RECURRENCE_RULES };

const recurrenceRulesFor = (language) =>
    RECURRENCE_RULES[normalizeLanguage(language)] || [];

module.exports = {
    dateParserFor,
    dateLeadPatternFor,
    isLocalizedDateNoise,
    recurrenceRulesFor,
};
