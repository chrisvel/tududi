const { parseEvents } = require('../../../../modules/subscribed-calendars/ics');

const FROM = new Date('2026-08-01T00:00:00Z');
const TO = new Date('2026-11-01T00:00:00Z');

function buildCalendar(...vevents) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//tududi//test//EN',
        ...vevents,
        'END:VCALENDAR',
    ].join('\r\n');
}

describe('subscribed calendars – ics parser', () => {
    it('parses a timed event', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:timed',
            'DTSTART:20260820T140000Z',
            'DTEND:20260820T150000Z',
            'SUMMARY:Sprint review',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('Sprint review');
        expect(events[0].all_day).toBe(false);
        expect(events[0].start).toBe('2026-08-20T14:00:00.000Z');
    });

    it('reports all-day events as dates, not timestamps', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:allday',
            'DTSTART;VALUE=DATE:20260820',
            'DTEND;VALUE=DATE:20260821',
            'SUMMARY:Day off',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        expect(events[0].all_day).toBe(true);
        // A timestamp here would shift the event a day in other timezones.
        expect(events[0].start).toBe('2026-08-20');
        expect(events[0].end).toBe('2026-08-20');
    });

    it('reports the inclusive last day of a multi-day all-day event', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:vacation',
            'DTSTART;VALUE=DATE:20260901',
            'DTEND;VALUE=DATE:20260906',
            'SUMMARY:Vacation',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        // DTEND is exclusive in iCalendar; the last covered day is the 5th.
        expect(events[0].start).toBe('2026-09-01');
        expect(events[0].end).toBe('2026-09-05');
    });

    it('expands recurring events inside the window', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:monthly',
            'DTSTART:20260801T090000Z',
            'DTEND:20260801T093000Z',
            'RRULE:FREQ=MONTHLY',
            'SUMMARY:Monthly standup',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        expect(events).toHaveLength(3);
        expect(events.map((event) => event.start.slice(0, 10))).toEqual([
            '2026-08-01',
            '2026-09-01',
            '2026-10-01',
        ]);
    });

    it('does not hang on an unbounded recurrence rule', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:daily',
            'DTSTART:20260101T090000Z',
            'DTEND:20260101T091000Z',
            'RRULE:FREQ=DAILY',
            'SUMMARY:Daily',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        expect(events.length).toBeGreaterThan(80);
        expect(events.length).toBeLessThan(100);
    });

    it('skips events outside the window', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:old',
            'DTSTART:20200101T090000Z',
            'DTEND:20200101T093000Z',
            'SUMMARY:Ancient history',
            'END:VEVENT'
        );

        expect(parseEvents(ics, FROM, TO, 1)).toHaveLength(0);
    });

    it('applies a RECURRENCE-ID override to its series', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:series',
            'DTSTART:20260803T090000Z',
            'DTEND:20260803T093000Z',
            'RRULE:FREQ=WEEKLY;COUNT=3',
            'SUMMARY:Weekly sync',
            'END:VEVENT',
            'BEGIN:VEVENT',
            'UID:series',
            'RECURRENCE-ID:20260810T090000Z',
            'DTSTART:20260810T090000Z',
            'DTEND:20260810T093000Z',
            'SUMMARY:Weekly sync (moved)',
            'END:VEVENT'
        );

        const events = parseEvents(ics, FROM, TO, 1);

        expect(events).toHaveLength(3);
        expect(events.map((event) => event.title)).toContain(
            'Weekly sync (moved)'
        );
    });

    it('falls back to a placeholder title when SUMMARY is missing', () => {
        const ics = buildCalendar(
            'BEGIN:VEVENT',
            'UID:untitled',
            'DTSTART:20260820T140000Z',
            'DTEND:20260820T150000Z',
            'END:VEVENT'
        );

        expect(parseEvents(ics, FROM, TO, 1)[0].title).toBe('(no title)');
    });
});
