'use strict';

const ICAL = require('ical.js');
const moment = require('moment-timezone');

const MAX_ITERATIONS = 20000;

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

function buildOccurrence(event, start, end, date, userTimezone, tzid) {
    if (isCancelled(event)) return null;

    if (start.isDate) {
        const first = dateOnly(start);
        const last = end ? dateOnly(end) : null;
        const overlaps = first <= date && (last ? date < last : date === first);
        if (!overlaps) return null;
        return {
            uid: event.uid,
            title: event.summary || '',
            all_day: true,
            busy: false,
            start: first,
            end: last || first,
            start_minute: null,
            end_minute: null,
        };
    }

    const startAt = toMoment(start, tzid, userTimezone);
    const endAt = end
        ? toMoment(end, end.zone === start.zone ? tzid : null, userTimezone)
        : startAt.clone();
    const dayStart = moment.tz(date, 'YYYY-MM-DD', userTimezone);
    const dayEnd = dayStart.clone().add(1, 'day');

    const touchesDay =
        startAt.isBefore(dayEnd) &&
        (endAt.isAfter(dayStart) ||
            (endAt.isSame(startAt) && !startAt.isBefore(dayStart)));
    if (!touchesDay) return null;

    const clippedStart = moment.max(startAt, dayStart);
    const clippedEnd = moment.min(endAt, dayEnd);
    return {
        uid: event.uid,
        title: event.summary || '',
        all_day: false,
        busy: isBusy(event),
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        start_minute: clippedStart.diff(dayStart, 'minutes'),
        end_minute: clippedEnd.diff(dayStart, 'minutes'),
    };
}

function eachDay(startDate, endDate, userTimezone) {
    const days = [];
    const last = moment.tz(endDate, 'YYYY-MM-DD', userTimezone);
    for (
        const day = moment.tz(startDate, 'YYYY-MM-DD', userTimezone);
        !day.isAfter(last);
        day.add(1, 'day')
    ) {
        days.push(day.format('YYYY-MM-DD'));
    }
    return days;
}

// Every event touching a day from `startDate` to `endDate` (YYYY-MM-DD) in
// the user's timezone, with recurring events expanded (RRULE, RDATE, EXDATE
// and moved instances). An event spanning several days appears once per day,
// each tagged with that `date`.
function eventsForRange(events, startDate, endDate, userTimezone) {
    const days = eachDay(startDate, endDate, userTimezone);
    // Pad the window by a day each side: zone offsets can shift an
    // occurrence's local date either way.
    const windowStart = moment
        .tz(startDate, 'YYYY-MM-DD', userTimezone)
        .subtract(1, 'day');
    const windowEnd = moment
        .tz(endDate, 'YYYY-MM-DD', userTimezone)
        .add(2, 'day');
    const results = [];

    const collect = (event, start, end, tzid) => {
        for (const day of days) {
            const occurrence = buildOccurrence(
                event,
                start,
                end,
                day,
                userTimezone,
                tzid
            );
            if (occurrence) results.push({ ...occurrence, date: day });
        }
    };

    for (const event of events) {
        const tzid = event.component
            .getFirstProperty('dtstart')
            ?.getParameter('tzid');

        if (!event.isRecurring()) {
            collect(event, event.startDate, event.endDate, tzid);
            continue;
        }

        const iterator = event.iterator();
        let next;
        let count = 0;
        while ((next = iterator.next()) && count++ < MAX_ITERATIONS) {
            const at = next.isDate
                ? moment.tz(dateOnly(next), 'YYYY-MM-DD', userTimezone)
                : toMoment(next, tzid, userTimezone);
            if (at.isAfter(windowEnd)) break;

            const details = event.getOccurrenceDetails(next);
            const endAt = details.endDate.isDate
                ? moment.tz(
                      dateOnly(details.endDate),
                      'YYYY-MM-DD',
                      userTimezone
                  )
                : toMoment(details.endDate, tzid, userTimezone);
            if (endAt.isBefore(windowStart)) continue;

            collect(
                details.item,
                details.startDate,
                details.endDate,
                details.item === event
                    ? tzid
                    : details.item.component
                          .getFirstProperty('dtstart')
                          ?.getParameter('tzid')
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
