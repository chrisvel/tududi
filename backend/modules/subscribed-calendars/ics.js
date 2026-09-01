'use strict';

const ICAL = require('ical.js');

// Guards against a malformed or hostile feed with an unbounded RRULE.
const MAX_OCCURRENCES_PER_EVENT = 500;
const MAX_EVENTS = 5000;

function toEvent(details, calendarId) {
    const start = details.startDate;
    const end = details.endDate;
    const base = {
        id: `ics-${calendarId}-${details.item.uid}-${start.toUnixTime()}`,
        title: details.item.summary || '(no title)',
    };

    if (start.isDate) {
        // DTEND is exclusive for all-day events, so a single day event ends on
        // the following day. Report the last day actually covered instead.
        const lastDay = end.clone();
        if (end.compare(start) > 0) {
            lastDay.adjust(-1, 0, 0, 0);
        }
        return {
            ...base,
            start: start.toString(),
            end: lastDay.toString(),
            all_day: true,
        };
    }

    return {
        ...base,
        start: start.toJSDate().toISOString(),
        end: end.toJSDate().toISOString(),
        all_day: false,
    };
}

function expandRecurring(event, from, to, calendarId) {
    const occurrences = [];
    const iterator = event.iterator();
    let count = 0;
    let next;

    while ((next = iterator.next())) {
        if (++count > MAX_OCCURRENCES_PER_EVENT) break;

        const details = event.getOccurrenceDetails(next);
        if (details.startDate.toJSDate() > to) break;
        if (details.endDate.toJSDate() < from) continue;

        occurrences.push(toEvent(details, calendarId));
    }

    return occurrences;
}

// Returns the events of an iCalendar feed that overlap [from, to].
function parseEvents(icsText, from, to, calendarId) {
    const component = new ICAL.Component(ICAL.parse(icsText));
    const vevents = component.getAllSubcomponents('vevent');

    const series = new Map();
    const overrides = [];

    for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        if (!event.startDate) continue;

        if (event.isRecurrenceException()) {
            overrides.push(event);
        } else {
            series.set(event.uid, event);
        }
    }

    // A RECURRENCE-ID entry modifies one occurrence of its series. Without the
    // parent it is just a standalone event.
    for (const override of overrides) {
        const parent = series.get(override.uid);
        if (parent) {
            parent.relateException(override);
        } else {
            series.set(`${override.uid}-${override.recurrenceId}`, override);
        }
    }

    const events = [];
    for (const event of series.values()) {
        if (events.length >= MAX_EVENTS) break;

        if (event.isRecurring()) {
            events.push(...expandRecurring(event, from, to, calendarId));
            continue;
        }

        const details = event.getOccurrenceDetails(event.startDate);
        if (details.startDate.toJSDate() > to) continue;
        if (details.endDate.toJSDate() < from) continue;
        events.push(toEvent(details, calendarId));
    }

    return events.slice(0, MAX_EVENTS);
}

module.exports = { parseEvents };
