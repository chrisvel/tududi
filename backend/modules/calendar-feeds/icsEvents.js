'use strict';

const ICAL = require('ical.js');
const moment = require('moment-timezone');

const MAX_ITERATIONS = 20000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Dates are compared as printed in the event's own zone, which can sit more
// than a day from the user's. The pad only ever lets extra events through to
// the exact, zone-aware check.
const WINDOW_PAD_DAYS = 3;

function parseCalendar(text) {
    const root = new ICAL.Component(ICAL.parse(text));

    // Feeds from Outlook and others use their own zone names, defined inline.
    for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
        const zone = new ICAL.Timezone(vtimezone);
        if (zone.tzid && !ICAL.TimezoneService.has(zone.tzid)) {
            ICAL.TimezoneService.register(zone);
        }
    }

    const masters = new Map();
    const exceptions = [];
    for (const vevent of root.getAllSubcomponents('vevent')) {
        const event = new ICAL.Event(vevent);
        if (!event.uid) continue;
        if (event.isRecurrenceException()) {
            exceptions.push(event);
        } else {
            masters.set(event.uid, event);
        }
    }
    for (const exception of exceptions) {
        const master = masters.get(exception.uid);
        if (master) {
            master.relateException(exception);
        } else {
            masters.set(
                `${exception.uid}#${exception.recurrenceId}`,
                exception
            );
        }
    }

    return [...masters.values()];
}

// Turns an ICAL.Time into an absolute instant. IANA zone names go through
// moment-timezone; floating times are read in the user's own zone.
function toMoment(time, tzid, userTimezone) {
    const parts = [
        time.year,
        time.month - 1,
        time.day,
        time.hour,
        time.minute,
        time.second,
    ];
    if (time.zone === ICAL.Timezone.utcTimezone) {
        return moment.utc(parts);
    }
    if (tzid && moment.tz.zone(tzid)) {
        return moment.tz(parts, tzid);
    }
    if (time.zone && time.zone !== ICAL.Timezone.localTimezone) {
        return moment.utc(time.toUnixTime() * 1000);
    }
    return moment.tz(parts, userTimezone);
}

function dateOnly(time) {
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(
        time.day
    ).padStart(2, '0')}`;
}

function isCancelled(event) {
    const status = event.component.getFirstPropertyValue('status');
    return typeof status === 'string' && status.toUpperCase() === 'CANCELLED';
}

function isBusy(event) {
    const transp = event.component.getFirstPropertyValue('transp');
    return !(
        typeof transp === 'string' && transp.toUpperCase() === 'TRANSPARENT'
    );
}

// Minutes on the user's clock, not elapsed time: on a DST change day 16:00
// is 15 or 17 hours after midnight, but must still sit at 16:00.
function wallMinute(at, dayStart, dayEnd) {
    if (!at.isAfter(dayStart)) return 0;
    if (!at.isBefore(dayEnd)) return 24 * 60;
    const local = at.clone().tz(dayStart.tz());
    return local.hours() * 60 + local.minutes();
}

function dayBoundsBetween(startDate, endDate, userTimezone) {
    const bounds = [];
    const last = moment.tz(endDate, 'YYYY-MM-DD', userTimezone);
    for (
        const day = moment.tz(startDate, 'YYYY-MM-DD', userTimezone);
        !day.isAfter(last);
        day.add(1, 'day')
    ) {
        const date = day.format('YYYY-MM-DD');
        const dayStart = moment.tz(date, 'YYYY-MM-DD', userTimezone);
        const dayEnd = dayStart.clone().add(1, 'day');
        bounds.push({ date, dayStart, dayEnd });
    }
    return bounds;
}

// One entry per day of `dayBounds` that the occurrence touches.
function occurrencesByDay(event, start, end, dayBounds, userTimezone, tzid) {
    if (isCancelled(event)) return [];
    const results = [];

    if (start.isDate) {
        const first = dateOnly(start);
        const last = end ? dateOnly(end) : null;
        for (const { date } of dayBounds) {
            const overlaps =
                first <= date && (last ? date < last : date === first);
            if (!overlaps) continue;
            results.push({
                uid: event.uid,
                title: event.summary || '',
                all_day: true,
                busy: false,
                start: first,
                end: last || first,
                start_minute: null,
                end_minute: null,
                date,
            });
        }
        return results;
    }

    const startAt = toMoment(start, tzid, userTimezone);
    const endAt = end
        ? toMoment(end, end.zone === start.zone ? tzid : null, userTimezone)
        : startAt.clone();
    const startMs = startAt.valueOf();
    const endMs = endAt.valueOf();

    for (const { date, dayStart, dayEnd } of dayBounds) {
        const dayStartMs = dayStart.valueOf();
        const touchesDay =
            startMs < dayEnd.valueOf() &&
            (endMs > dayStartMs ||
                (endMs === startMs && startMs >= dayStartMs));
        if (!touchesDay) continue;

        const clippedStart = moment.max(startAt, dayStart);
        const clippedEnd = moment.min(endAt, dayEnd);
        results.push({
            uid: event.uid,
            title: event.summary || '',
            all_day: false,
            busy: isBusy(event),
            start: startAt.toISOString(),
            end: endAt.toISOString(),
            start_minute: wallMinute(clippedStart, dayStart, dayEnd),
            end_minute: wallMinute(clippedEnd, dayStart, dayEnd),
            date,
        });
    }
    return results;
}

// The calendar date printed on an ICAL.Time, as a day count. Comparing these
// needs no timezone work, which is what makes skipping old events cheap.
function dayNumber(year, month, day) {
    return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function timeDayNumber(time) {
    return dayNumber(time.year, time.month, time.day);
}

// A moved instance can land in the window from anywhere in the series, and a
// RANGE=THISANDFUTURE exception shifts every later occurrence.
function hasExceptionInWindow(event, firstDay, lastDay) {
    if (event.rangeExceptions.length > 0) return true;
    return Object.values(event.exceptions).some(
        (exception) =>
            timeDayNumber(exception.endDate) >= firstDay &&
            timeDayNumber(exception.startDate) <= lastDay
    );
}

// The single RRULE of a series, or null when it also has RDATEs or several
// rules, whose dates cannot be reasoned about from one rule alone.
function singleRule(event) {
    if (event.component.hasProperty('rdate')) return null;
    const rules = event.component.getAllProperties('rrule');
    return rules.length === 1 ? rules[0].getFirstValue() : null;
}

function endedBefore(event, day) {
    const rule = singleRule(event);
    return Boolean(rule?.until) && timeDayNumber(rule.until) <= day;
}

// How many days apart a rule's cycles are, when every cycle looks the same.
// Months and years vary in length, and a COUNT has to be walked to be spent.
function fixedCycleDays(rule) {
    if (rule.count) return null;
    const parts = Object.keys(rule.parts);
    const interval = rule.interval || 1;
    if (rule.freq === 'DAILY' && parts.length === 0) return interval;
    if (
        rule.freq === 'WEEKLY' &&
        parts.every((part) => part === 'BYDAY') &&
        (rule.parts.BYDAY || []).every((byDay) => /^[A-Z]{2}$/.test(byDay))
    ) {
        return interval * 7;
    }
    return null;
}

// Where to start expanding a long-running series: a whole number of cycles
// after DTSTART, so the pattern stays aligned, and still before `day`.
function startNear(event, day) {
    const rule = singleRule(event);
    const cycleDays = rule && fixedCycleDays(rule);
    if (!cycleDays) return undefined;

    const cycles = Math.floor(
        (day - timeDayNumber(event.startDate)) / cycleDays
    );
    if (cycles <= 0) return undefined;

    const start = event.startDate.clone();
    start.adjust(cycles * cycleDays, 0, 0, 0);
    return start;
}

// Every event touching a day from `startDate` to `endDate` (YYYY-MM-DD) in
// the user's timezone, with recurring events expanded (RRULE, RDATE, EXDATE
// and moved instances). An event spanning several days appears once per day,
// each tagged with that `date`.
function eventsForRange(events, startDate, endDate, userTimezone) {
    const dayBounds = dayBoundsBetween(startDate, endDate, userTimezone);
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const firstDay =
        dayNumber(startYear, startMonth, startDay) - WINDOW_PAD_DAYS;
    const lastDay = dayNumber(endYear, endMonth, endDay) + WINDOW_PAD_DAYS;
    const results = [];

    for (const event of events) {
        const tzid = event.component
            .getFirstProperty('dtstart')
            ?.getParameter('tzid');

        if (!event.isRecurring()) {
            const { startDate: start, endDate: end } = event;
            if (
                timeDayNumber(end) < firstDay ||
                timeDayNumber(start) > lastDay
            ) {
                continue;
            }
            results.push(
                ...occurrencesByDay(
                    event,
                    start,
                    end,
                    dayBounds,
                    userTimezone,
                    tzid
                )
            );
            continue;
        }

        const lengthInDays =
            timeDayNumber(event.endDate) - timeDayNumber(event.startDate);
        const canSkipOld = !hasExceptionInWindow(event, firstDay, lastDay);
        const lastStartToSkip = firstDay - lengthInDays - 1;
        if (canSkipOld && endedBefore(event, lastStartToSkip)) continue;

        const iterator = event.iterator(
            canSkipOld ? startNear(event, lastStartToSkip) : undefined
        );
        let next;
        let count = 0;
        while ((next = iterator.next()) && count++ < MAX_ITERATIONS) {
            const day = timeDayNumber(next);
            if (day > lastDay) break;
            if (canSkipOld && day <= lastStartToSkip) continue;

            const details = event.getOccurrenceDetails(next);
            results.push(
                ...occurrencesByDay(
                    details.item,
                    details.startDate,
                    details.endDate,
                    dayBounds,
                    userTimezone,
                    details.item === event
                        ? tzid
                        : details.item.component
                              .getFirstProperty('dtstart')
                              ?.getParameter('tzid')
                )
            );
        }
    }

    return results.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        return (a.start_minute ?? 0) - (b.start_minute ?? 0);
    });
}

// Every event touching `date` (YYYY-MM-DD), in start order.
function eventsForDate(events, date, userTimezone) {
    return eventsForRange(events, date, date, userTimezone).map(
        ({ date: _date, ...occurrence }) => occurrence
    );
}

module.exports = { parseCalendar, eventsForDate, eventsForRange };
