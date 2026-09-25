'use strict';

// Natural-language parsing for inbox capture: due dates ("tomorrow",
// "next fri"), recurrence ("every monday") and @person references.
// Positions are always reported against the original text so callers can
// cut the matched phrase out of the title.

const chrono = require('chrono-node');
const moment = require('moment-timezone');

const WEEKDAYS = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
};

const ORDINALS = {
    first: 1,
    '1st': 1,
    second: 2,
    '2nd': 2,
    third: 3,
    '3rd': 3,
    fourth: 4,
    '4th': 4,
    last: 5,
};

// Bare words chrono reads as dates but that are usually just words.
const AMBIGUOUS_DATE_WORDS = new Set(['sun', 'sat', 'wed', 'mar', 'may']);

const WEEKDAY_PATTERN =
    '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)';

// Replace #tags, +projects, @people and URLs with spaces of equal length so
// the date parsers never match inside them and indexes stay aligned.
const maskTokens = (text) =>
    text.replace(
        /https?:\/\/\S+|(^|\s)([#+@](?:"[^"]*"|\S+))/g,
        (match, lead = '') =>
            match.startsWith('http')
                ? ' '.repeat(match.length)
                : lead + ' '.repeat(match.length - lead.length)
    );

const todayInTimezone = (timezone) => moment.tz(timezone).format('YYYY-MM-DD');

const formatUtcDate = (date) => date.toISOString().slice(0, 10);

const firstMonthlyWeekday = (todayStr, weekday, weekOfMonth) => {
    const today = new Date(`${todayStr}T00:00:00Z`);
    const occurrenceIn = (year, month) => {
        const first = new Date(Date.UTC(year, month, 1));
        const offset = (weekday - first.getUTCDay() + 7) % 7;
        const target = new Date(Date.UTC(year, month, 1 + offset));
        target.setUTCDate(target.getUTCDate() + (weekOfMonth - 1) * 7);
        if (target.getUTCMonth() !== month) {
            target.setUTCDate(target.getUTCDate() - 7);
        }
        return target;
    };
    let candidate = occurrenceIn(today.getUTCFullYear(), today.getUTCMonth());
    if (candidate < today) {
        candidate = occurrenceIn(
            today.getUTCFullYear(),
            today.getUTCMonth() + 1
        );
    }
    return formatUtcDate(candidate);
};

const lastDayOfMonth = (todayStr) => {
    const today = new Date(`${todayStr}T00:00:00Z`);
    return formatUtcDate(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    );
};

const firstOccurrence = (recurrence, timezone) => {
    const today = todayInTimezone(timezone);
    if (recurrence.recurrence_type === 'monthly_weekday') {
        return firstMonthlyWeekday(
            today,
            recurrence.recurrence_weekday,
            recurrence.recurrence_week_of_month
        );
    }
    if (recurrence.recurrence_type === 'monthly_last_day') {
        return lastDayOfMonth(today);
    }
    // Required lazily: builders pulls in the models layer.
    const { calculateInitialDueDate } = require('../tasks/core/builders');
    return calculateInitialDueDate(recurrence, timezone);
};

const parseWeekdayList = (list) => {
    const days = list
        .toLowerCase()
        .split(/\s*(?:,|\band\b|&)\s*/)
        .map((word) => WEEKDAYS[word.trim()])
        .filter((day) => day !== undefined);
    return [...new Set(days)].sort((a, b) => a - b);
};

const unitRecurrence = (unit, interval) => {
    const normalized = unit.toLowerCase().replace(/s$/, '');
    const type = { day: 'daily', week: 'weekly', month: 'monthly' }[normalized];
    return type
        ? { recurrence_type: type, recurrence_interval: interval }
        : null;
};

// Ordered most specific first; the first rule that matches wins.
const RECURRENCE_RULES = [
    {
        pattern: new RegExp(
            `\\bevery\\s+(first|second|third|fourth|last|1st|2nd|3rd|4th)\\s+(${WEEKDAY_PATTERN})(?:\\s+of\\s+(?:the\\s+)?month)?\\b`,
            'i'
        ),
        build: (m) => ({
            recurrence_type: 'monthly_weekday',
            recurrence_interval: 1,
            recurrence_weekday: WEEKDAYS[m[2].toLowerCase()],
            recurrence_week_of_month: ORDINALS[m[1].toLowerCase()],
        }),
    },
    {
        pattern: /\bevery\s+last\s+day(?:\s+of\s+(?:the\s+)?month)?\b/i,
        build: () => ({
            recurrence_type: 'monthly_last_day',
            recurrence_interval: 1,
        }),
    },
    {
        pattern:
            /\bevery\s+month\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b|\bevery\s+(\d{1,2})(?:st|nd|rd|th)\b/i,
        build: (m) => {
            const day = Number(m[1] || m[2]);
            if (day < 1 || day > 31) return null;
            return {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: day,
            };
        },
    },
    {
        pattern: /\bevery\s+(?:weekday|workday)\b/i,
        build: () => ({
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekdays: [1, 2, 3, 4, 5],
        }),
    },
    {
        pattern: new RegExp(
            `\\bevery\\s+(${WEEKDAY_PATTERN}(?:\\s*(?:,|\\band\\b|&)\\s*${WEEKDAY_PATTERN})*)\\b`,
            'i'
        ),
        build: (m) => {
            const weekdays = parseWeekdayList(m[1]);
            if (weekdays.length === 0) return null;
            return {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekdays: weekdays,
            };
        },
    },
    {
        pattern: /\bevery\s+(\d{1,3})\s+(days?|weeks?|months?)\b/i,
        build: (m) => {
            const interval = Number(m[1]);
            if (interval < 1) return null;
            return unitRecurrence(m[2], interval);
        },
    },
    {
        pattern: /\bevery\s+(other\s+)?(day|week|month)\b/i,
        build: (m) => unitRecurrence(m[2], m[1] ? 2 : 1),
    },
    {
        // Bare "daily" only at the end, so "write weekly report" stays a title.
        pattern: /\b(daily|weekly|monthly)[.!]?\s*$/i,
        build: (m) =>
            unitRecurrence(
                { daily: 'day', weekly: 'week', monthly: 'month' }[
                    m[1].toLowerCase()
                ],
                1
            ),
    },
];

const parseRecurrence = (text, { timezone = 'UTC' } = {}) => {
    const masked = maskTokens(text);
    for (const rule of RECURRENCE_RULES) {
        const match = rule.pattern.exec(masked);
        if (!match) continue;
        const recurrence = rule.build(match);
        if (!recurrence) continue;
        return {
            recurrence,
            date: firstOccurrence(recurrence, timezone),
            text: text.substr(match.index, match[0].length),
            index: match.index,
            removable: true,
        };
    }
    return null;
};

const parseDueDate = (
    text,
    { referenceDate = new Date(), timezone = 'UTC' } = {}
) => {
    const masked = maskTokens(text);
    const reference = {
        instant: referenceDate,
        timezone: moment.tz(referenceDate, timezone).utcOffset(),
    };
    const results = chrono.casual
        .parse(masked, reference, { forwardDate: true })
        .filter((result) => {
            const start = result.start;
            if (!start.isCertain('day') && !start.isCertain('weekday')) {
                return false;
            }
            return !AMBIGUOUS_DATE_WORDS.has(result.text.trim().toLowerCase());
        });
    if (results.length === 0) return null;

    const result = results[results.length - 1];
    const date = [
        String(result.start.get('year')).padStart(4, '0'),
        String(result.start.get('month')).padStart(2, '0'),
        String(result.start.get('day')).padStart(2, '0'),
    ].join('-');

    return {
        date,
        text: text.substr(result.index, result.text.length),
        index: result.index,
        // Times are not stored, so a phrase with one stays in the title.
        removable: !result.start.isCertain('hour'),
    };
};

// @Name or @"Full Name", only at the start of a word so emails never match.
const parsePersonRef = (text) => {
    const match = /(^|\s)@(?:"([^"]+)"|([^\s"@]+))/u.exec(text);
    if (!match) return null;
    const name = (match[2] || match[3] || '').replace(/[.,;:!?)]+$/, '').trim();
    if (!name) return null;
    const start = match.index + match[1].length;
    const raw = match[2] ? match[0].slice(match[1].length) : `@${name}`;
    return { name, text: raw, index: start };
};

// Cut the given spans out of the text and collapse the leftover spacing.
const removeSpans = (text, spans) =>
    spans
        .filter(Boolean)
        .sort((a, b) => b.index - a.index)
        .reduce(
            (result, span) =>
                result.slice(0, span.index) +
                ' ' +
                result.slice(span.index + span.text.length),
            text
        )
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +\n/g, '\n')
        .replace(/\n +/g, '\n')
        .trim();

module.exports = {
    maskTokens,
    parseDueDate,
    parseRecurrence,
    parsePersonRef,
    removeSpans,
};
