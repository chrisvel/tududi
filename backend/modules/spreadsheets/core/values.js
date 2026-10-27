'use strict';

const moment = require('moment-timezone');
const chrono = require('chrono-node');
const { Task } = require('../../../models');
const { allTranslations } = require('./locales');
const { normalizeHeader } = require('./columns');

const ISO_DATE =
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const YMD_SLASH = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:\s+(.+))?$/;
const NUMERIC_DATE =
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:,?\s+(.+))?$/;
const TIME = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/i;

function pad(n) {
    return String(n).padStart(2, '0');
}

function validYmd(y, m, d) {
    return moment(`${y}-${pad(m)}-${pad(d)}`, 'YYYY-MM-DD', true).isValid();
}

function parseTime(text) {
    if (!text) return null;
    const match = TIME.exec(text.trim());
    if (!match) return undefined;
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const meridiem = match[3] ? match[3].toLowerCase().replace(/\./g, '') : '';
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return undefined;
    // Midnight on its own is how spreadsheets write a date without a time.
    if (hours === 0 && minutes === 0 && !meridiem) return null;
    return `${pad(hours)}:${pad(minutes)}`;
}

// Whether a day/month/year cell reads as day-first, month-first, or could be
// either. Used to settle a whole column's order before reading it.
function numericOrder(text) {
    const match = NUMERIC_DATE.exec(String(text ?? '').trim());
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) return 'dmy';
    if (second > 12 && first <= 12) return 'mdy';
    return 'either';
}

// Settles day-first or month-first for a column from the values that can only
// be read one way. Returns null when nothing in the column decides it.
function detectDateOrder(values) {
    let dmy = 0;
    let mdy = 0;
    for (const value of values) {
        const order = numericOrder(value);
        if (order === 'dmy') dmy++;
        if (order === 'mdy') mdy++;
    }
    if (dmy && !mdy) return 'dmy';
    if (mdy && !dmy) return 'mdy';
    return null;
}

// Reads a date cell into { date: 'YYYY-MM-DD', time: 'HH:mm' | null }.
// `order` decides 03/04/2026; returns { error } for anything unreadable.
function parseDateCell(raw, order = 'dmy') {
    const text = String(raw ?? '').trim();
    if (!text) return null;

    let match = ISO_DATE.exec(text);
    if (match) {
        const [, y, m, d, hh, mm] = match;
        if (!validYmd(y, m, d)) return { error: 'invalid_date' };
        const time = hh !== undefined ? parseTime(`${hh}:${mm}`) : null;
        return { date: `${y}-${pad(m)}-${pad(d)}`, time: time || null };
    }

    match = YMD_SLASH.exec(text);
    if (match) {
        const [, y, m, d, rest] = match;
        const time = parseTime(rest);
        if (!validYmd(y, m, d) || time === undefined) {
            return { error: 'invalid_date' };
        }
        return { date: `${y}-${pad(m)}-${pad(d)}`, time };
    }

    match = NUMERIC_DATE.exec(text);
    if (match) {
        const [, a, b, yearText, rest] = match;
        const year =
            yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
        const [d, m] = order === 'mdy' ? [b, a] : [a, b];
        const time = parseTime(rest);
        if (!validYmd(year, m, d) || time === undefined) {
            return { error: 'invalid_date' };
        }
        return { date: `${year}-${pad(m)}-${pad(d)}`, time };
    }

    // Written-out dates ("12 March 2026", "Mar 12, 2026 3pm").
    const parsed = chrono.parse(text, new Date(), { forwardDate: false })[0];
    if (parsed && parsed.start.isCertain('year')) {
        const c = parsed.start;
        const date = `${c.get('year')}-${pad(c.get('month'))}-${pad(c.get('day'))}`;
        const time = c.isCertain('hour')
            ? `${pad(c.get('hour'))}:${pad(c.get('minute') || 0)}`
            : null;
        return { date, time };
    }

    return { error: 'invalid_date' };
}

// Status words, matched case- and accent-insensitively. Tududi's own labels
// in every language come first, then what other tools export.
const STATUS_WORDS = {
    [Task.STATUS.NOT_STARTED]: [
        'not started',
        'not_started',
        'to do',
        'todo',
        'open',
        'new',
        'backlog',
        'pending',
        'no',
        'false',
        '0%',
    ],
    [Task.STATUS.IN_PROGRESS]: [
        'in progress',
        'in_progress',
        'doing',
        'started',
        'wip',
        'working on it',
        'active',
        'ongoing',
    ],
    [Task.STATUS.DONE]: [
        'done',
        'completed',
        'complete',
        'closed',
        'finished',
        'resolved',
        'yes',
        'true',
        'x',
        '\u2713',
        '\u2714',
        '100%',
    ],
    [Task.STATUS.ARCHIVED]: ['archived'],
    [Task.STATUS.WAITING]: [
        'waiting',
        'on hold',
        'blocked',
        'stuck',
        'paused',
        'waiting for',
        'deferred',
    ],
    [Task.STATUS.CANCELLED]: ['cancelled', 'canceled', 'dropped', "won't do"],
    [Task.STATUS.PLANNED]: ['planned', 'scheduled', 'up next', 'next'],
};

const STATUS_LABEL_KEYS = {
    [Task.STATUS.NOT_STARTED]: ['status.notStarted', 'task.status.notStarted'],
    [Task.STATUS.IN_PROGRESS]: ['status.inProgress', 'task.status.inProgress'],
    [Task.STATUS.DONE]: ['status.done', 'status.completed'],
    [Task.STATUS.ARCHIVED]: ['status.archived'],
    [Task.STATUS.WAITING]: ['status.waiting', 'task.status.waiting'],
    [Task.STATUS.CANCELLED]: ['task.status.cancelled'],
    [Task.STATUS.PLANNED]: ['task.status.planned'],
};

const PRIORITY_WORDS = {
    [Task.PRIORITY.LOW]: ['low', 'lowest', 'minor', 'p3', 'p4'],
    [Task.PRIORITY.MEDIUM]: ['medium', 'normal', 'moderate', 'p2'],
    [Task.PRIORITY.HIGH]: [
        'high',
        'highest',
        'urgent',
        'critical',
        'important',
        'p1',
        'p0',
    ],
};

const PRIORITY_LABEL_KEYS = {
    [Task.PRIORITY.LOW]: ['priority.low'],
    [Task.PRIORITY.MEDIUM]: ['priority.medium'],
    [Task.PRIORITY.HIGH]: ['priority.high'],
};

function normalizeWord(value) {
    return normalizeHeader(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function buildWordIndex(words, labelKeys) {
    const index = new Map();
    for (const [value, keys] of Object.entries(labelKeys)) {
        for (const key of keys) {
            for (const label of allTranslations(key)) {
                const word = normalizeWord(label);
                if (word && !index.has(word)) index.set(word, Number(value));
            }
        }
    }
    for (const [value, list] of Object.entries(words)) {
        for (const word of list) {
            const normalized = normalizeWord(word) || word;
            if (!index.has(normalized)) index.set(normalized, Number(value));
        }
    }
    return index;
}

let statusIndex = null;
let priorityIndex = null;

// The task status a cell names, or undefined when it names none. A percentage
// reads as progress: 0% not started, 100% done, anything between in progress.
function parseStatusCell(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    statusIndex =
        statusIndex || buildWordIndex(STATUS_WORDS, STATUS_LABEL_KEYS);
    const exact = statusIndex.get(normalizeWord(text));
    if (exact !== undefined) return exact;
    const percent = /^(\d{1,3}(?:\.\d+)?)\s*%$/.exec(text);
    if (percent) {
        const value = Number(percent[1]);
        if (value <= 0) return Task.STATUS.NOT_STARTED;
        if (value >= 100) return Task.STATUS.DONE;
        return Task.STATUS.IN_PROGRESS;
    }
    return undefined;
}

function parsePriorityCell(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    priorityIndex =
        priorityIndex || buildWordIndex(PRIORITY_WORDS, PRIORITY_LABEL_KEYS);
    const value = priorityIndex.get(normalizeWord(text));
    return value === undefined ? undefined : value;
}

// "90", "90m", "1.5h", "1h 30m", "1:30" -> minutes. Tasks hold 5 to 720.
function parseEstimateCell(raw) {
    const text = String(raw ?? '')
        .trim()
        .toLowerCase();
    if (!text) return null;
    let minutes;
    let match;
    if ((match = /^(\d+):(\d{2})$/.exec(text))) {
        minutes = Number(match[1]) * 60 + Number(match[2]);
    } else if ((match = /^(\d+(?:[.,]\d+)?)$/.exec(text))) {
        minutes = Number(match[1].replace(',', '.'));
    } else {
        const parts = [
            ...text.matchAll(
                /(\d+(?:[.,]\d+)?)\s*(d|days?|h|hrs?|hours?|m|mins?|minutes?)\b/g
            ),
        ];
        if (parts.length === 0) return { error: 'invalid_estimate' };
        minutes = parts.reduce((sum, [, amount, unit]) => {
            const n = Number(amount.replace(',', '.'));
            if (unit.startsWith('d')) return sum + n * 8 * 60;
            if (unit.startsWith('h')) return sum + n * 60;
            return sum + n;
        }, 0);
    }
    minutes = Math.round(minutes);
    if (minutes < 5 || minutes > 720) return { error: 'estimate_out_of_range' };
    return { minutes };
}

function splitList(raw) {
    return String(raw ?? '')
        .split(/[,;|\n]/)
        .map((part) => part.trim().replace(/^#/, '').trim())
        .filter(Boolean);
}

module.exports = {
    STATUS_LABEL_KEYS,
    PRIORITY_LABEL_KEYS,
    detectDateOrder,
    numericOrder,
    parseDateCell,
    parseStatusCell,
    parsePriorityCell,
    parseEstimateCell,
    splitList,
    normalizeWord,
};
