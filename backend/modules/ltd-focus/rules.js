'use strict';
const { ValidationError } = require('../../shared/errors');

const DEFAULTS = Object.freeze({
    focus_minutes: 25,
    short_break_minutes: 5,
    long_break_minutes: 15,
    long_every: 4,
    sound: false,
});
const validLength = (n) =>
    Number.isInteger(n) && n >= 5 && n <= 90 && n % 5 === 0;
function parseLength(value) {
    if (value === null) return null;
    if (!validLength(value))
        throw new ValidationError(
            'focus_minutes must be 5 to 90 in steps of 5'
        );
    return value;
}
function settings(raw = {}) {
    const result = { ...DEFAULTS };
    for (const key of [
        'focus_minutes',
        'short_break_minutes',
        'long_break_minutes',
    ])
        if (validLength(raw?.[key])) result[key] = raw[key];
    if (
        Number.isInteger(raw?.long_every) &&
        raw.long_every >= 1 &&
        raw.long_every <= 12
    )
        result.long_every = raw.long_every;
    result.sound = raw?.sound === true;
    return result;
}
const length = (task, prefs) =>
    task.focus_minutes ?? settings(prefs).focus_minutes;
const target = (estimate, minutes) =>
    estimate == null ? null : Math.max(1, Math.round(estimate / minutes));
const complete = (s) =>
    !!s.ended_at && !s.interrupted && s.actual_minutes + 1 >= s.planned_minutes;
const totals = (sessions) =>
    sessions.reduce(
        (sum, s) => {
            if (s.ended_at) {
                sum.spent_minutes += s.actual_minutes ?? 0;
                sum.completed_count += Number(complete(s));
            }
            return sum;
        },
        { spent_minutes: 0, completed_count: 0 }
    );
module.exports = {
    DEFAULTS,
    validLength,
    parseLength,
    settings,
    length,
    target,
    complete,
    totals,
};
