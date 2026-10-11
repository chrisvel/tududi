'use strict';
const moment = require('moment-timezone');
const DAY = 86400000;
const formatter = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
});
function parts(date) {
    const p = formatter.formatToParts(date);
    return Object.fromEntries(
        ['year', 'month', 'day'].map((key) => [
            key,
            Number(p.find((v) => v.type === key).value),
        ])
    );
}
// Same ICU conversion used by the Phase 3 calendar display layer.
function persianDate(year, month) {
    const offset = month <= 7 ? (month - 1) * 31 : 186 + (month - 7) * 30;
    const estimate = Date.UTC(year + 621, 2, 21) + offset * DAY;
    for (let delta = -4; delta <= 4; delta++) {
        const candidate = estimate + delta * DAY;
        const p = parts(candidate);
        if (p.year === year && p.month === month && p.day === 1)
            return candidate;
    }
    throw new Error('Could not resolve Persian calendar period');
}
function defaultPeriod(horizon, user, now = new Date()) {
    if (horizon === 'vision') return { period_start: null, period_end: null };
    let settings = user.ui_settings || {};
    if (typeof settings === 'string') settings = JSON.parse(settings);
    const persian =
        (settings.locale?.calendarSystem ||
            (user.language?.startsWith('fa') ? 'persian' : 'gregorian')) ===
        'persian';
    const today = moment(now)
        .tz(user.timezone || 'UTC')
        .format('YYYY-MM-DD');
    const date = new Date(`${today}T00:00:00Z`);
    let start, end;
    if (horizon === 'week') {
        const first = persian ? 6 : (user.first_day_of_week ?? 1);
        start = date.getTime() - ((date.getUTCDay() - first + 7) % 7) * DAY;
        end = start + 6 * DAY;
    } else {
        const p = persian
            ? parts(date)
            : { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
        const month =
            horizon === 'month'
                ? p.month
                : horizon === 'season'
                  ? Math.floor((p.month - 1) / 3) * 3 + 1
                  : 1;
        const months =
            horizon === 'month'
                ? 1
                : horizon === 'season'
                  ? 3
                  : horizon === 'five_year'
                    ? 60
                    : 12;
        const nextYear = p.year + Math.floor((month - 1 + months) / 12);
        const nextMonth = ((month - 1 + months) % 12) + 1;
        start = persian
            ? persianDate(p.year, month)
            : Date.UTC(p.year, month - 1, 1);
        end =
            (persian
                ? persianDate(nextYear, nextMonth)
                : Date.UTC(nextYear, nextMonth - 1, 1)) - DAY;
    }
    return {
        period_start: new Date(start).toISOString().slice(0, 10),
        period_end: new Date(end).toISOString().slice(0, 10),
    };
}
module.exports = { defaultPeriod };
