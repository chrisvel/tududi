const {
    parseVTODOToTask,
} = require('../../../../../modules/caldav/icalendar/vtodo-parser');

// A 2Do task with no timezone assigned sends floating times (no Z, no TZID).
// They are wall-clock times in the user's zone, not in the server's zone.
const vtodo = (lines) =>
    [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VTODO',
        'UID:floating-1',
        'SUMMARY:TZTest',
        ...lines,
        'END:VTODO',
        'END:VCALENDAR',
    ].join('\r\n');

describe('VTODO floating and TZID-by-reference times', () => {
    it('reads a floating DUE in the user timezone, not the process timezone', async () => {
        const task = await parseVTODOToTask(
            vtodo(['DUE:20261016T090000']),
            'Europe/Berlin'
        );
        expect(task.due_date.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    });

    it('reads a floating DTSTART in the user timezone', async () => {
        const task = await parseVTODOToTask(
            vtodo(['DTSTART:20261016T090000']),
            'Europe/Berlin'
        );
        expect(task.defer_until.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    });

    it('reads a TZID naming an IANA zone with no VTIMEZONE in that zone', async () => {
        const task = await parseVTODOToTask(
            vtodo(['DUE;TZID=Europe/Berlin:20261016T090000']),
            'America/New_York'
        );
        expect(task.due_date.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    });

    it('keeps an explicit UTC time as it is', async () => {
        const task = await parseVTODOToTask(
            vtodo(['DUE:20261016T090000Z']),
            'Europe/Berlin'
        );
        expect(task.due_date.toISOString()).toBe('2026-10-16T09:00:00.000Z');
    });

    it('falls back to the user timezone when TZID is not a known zone', async () => {
        const task = await parseVTODOToTask(
            vtodo(['DUE;TZID=Invalid/Timezone:20261016T090000']),
            'Europe/Berlin'
        );
        expect(task.due_date.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    });

    it('places a relative reminder from the corrected due time', async () => {
        const task = await parseVTODOToTask(
            vtodo([
                'DUE:20261016T090000',
                'BEGIN:VALARM',
                'TRIGGER;VALUE=DURATION:PT0S',
                'ACTION:AUDIO',
                'END:VALARM',
            ]),
            'Europe/Berlin'
        );
        expect(task.reminder_at.toISOString()).toBe('2026-10-16T07:00:00.000Z');
    });
});
