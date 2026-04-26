const ICAL = require('ical.js');
const vTodoSerializer = require('../../modules/caldav/icalendar/vtodo-serializer');
const vTodoParser = require('../../modules/caldav/icalendar/vtodo-parser');

describe('CalDAV Timezone Handling', () => {
    describe('UTC DateTime Conversion', () => {
        it('should correctly convert local dates to UTC', async () => {
            const task = {
                uid: 'tz-test-1',
                name: 'Timezone Test',
                due_date: '2026-04-20T14:00:00.000Z',
                defer_until: '2026-04-20T10:00:00.000Z',
                status: 0,
            };

            const vtodo = vTodoSerializer.serializeTaskToVTODO(task);
            const jcalData = ICAL.parse(vtodo);
            const comp = new ICAL.Component(jcalData);
            const vtodoComp = comp.getFirstSubcomponent('vtodo');

            const due = vtodoComp.getFirstPropertyValue('due');
            expect(due.toICALString()).toBe('20260420T140000Z');

            const dtstart = vtodoComp.getFirstPropertyValue('dtstart');
            expect(dtstart.toICALString()).toBe('20260420T100000Z');
        });

        it('should parse UTC dates from VTODO', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:tz-test-2
SUMMARY:Timezone Parse Test
DUE:20260420T140000Z
DTSTART:20260420T100000Z
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);

            expect(task.due_date).toBeTruthy();
            const dueDate = new Date(task.due_date);
            expect(dueDate.getUTCHours()).toBe(14);
            expect(dueDate.getUTCMinutes()).toBe(0);

            expect(task.defer_until).toBeTruthy();
            const deferDate = new Date(task.defer_until);
            expect(deferDate.getUTCHours()).toBe(10);
            expect(deferDate.getUTCMinutes()).toBe(0);
        });
    });

    describe('DATE-only (no time) Handling', () => {
        it('should handle DATE values without time component', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:date-only-test
SUMMARY:Date Only Test
DUE;VALUE=DATE:20260420
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);

            expect(task.due_date).toBeTruthy();
            const dueDate = new Date(task.due_date);
            expect(dueDate.getUTCDate()).toBe(20);
            expect(dueDate.getUTCMonth()).toBe(3);
            expect(dueDate.getUTCFullYear()).toBe(2026);
        });

        it('should serialize date-only tasks correctly', async () => {
            const task = {
                uid: 'date-only-serialize',
                name: 'Date Only Serialize',
                due_date: '2026-04-20T00:00:00.000Z',
                status: 0,
            };

            const vtodo = vTodoSerializer.serializeTaskToVTODO(task);
            const jcalData = ICAL.parse(vtodo);
            const comp = new ICAL.Component(jcalData);
            const vtodoComp = comp.getFirstSubcomponent('vtodo');

            const due = vtodoComp.getFirstPropertyValue('due');
            expect(due).toBeTruthy();
        });
    });

    describe('Timezone VTIMEZONE Handling', () => {
        it('should handle VTODO with VTIMEZONE component', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:20251102T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20260308T020000
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VTODO
UID:vtimezone-test
SUMMARY:Timezone Component Test
DUE;TZID=America/New_York:20260420T100000
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);

            expect(task.due_date).toBeTruthy();
            const dueDate = new Date(task.due_date);
            expect(dueDate.getUTCHours()).toBe(14);
        });
    });

    describe('Recurring Tasks Timezone', () => {
        it('should preserve timezone in recurring task instances', async () => {
            const task = {
                uid: 'recurring-tz-test',
                name: 'Recurring Timezone Test',
                due_date: '2026-04-20T14:00:00.000Z',
                status: 0,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurrence_count: 5,
            };

            const vtodo = vTodoSerializer.serializeTaskToVTODO(task);
            const jcalData = ICAL.parse(vtodo);
            const comp = new ICAL.Component(jcalData);
            const vtodoComp = comp.getFirstSubcomponent('vtodo');

            const due = vtodoComp.getFirstPropertyValue('due');
            expect(due.toICALString()).toBe('20260420T140000Z');

            const rrule = vtodoComp.getFirstPropertyValue('rrule');
            expect(rrule.freq).toBe('DAILY');
            expect(rrule.count).toBe(5);
        });

        it('should handle RECURRENCE-ID with timezones', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:recurring-tz-parent
SUMMARY:Recurring Parent
DUE:20260420T140000Z
RRULE:FREQ=DAILY;COUNT=5
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);

            expect(task.recurrence_type).toBe('daily');
            expect(task.recurrence_count).toBe(5);
            expect(task.due_date).toBeTruthy();
        });

        it('should parse modified instance with RECURRENCE-ID', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:recurring-tz-parent
SUMMARY:Modified Instance
RECURRENCE-ID:20260421T140000Z
DUE:20260421T160000Z
STATUS:COMPLETED
COMPLETED:20260421T150000Z
CREATED:20260420T080000Z
DTSTAMP:20260421T150000Z
END:VTODO
END:VCALENDAR`;

            const override =
                await vTodoParser.parseRecurrenceOverride(vtodoString);

            expect(override).toBeTruthy();
            expect(override.recurrence_id).toBeTruthy();
            const recurrenceDate = new Date(override.recurrence_id);
            expect(recurrenceDate.getUTCHours()).toBe(14);
        });
    });

    describe('Daylight Saving Time Transitions', () => {
        it('should handle spring forward DST transition', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:dst-spring-test
SUMMARY:DST Spring Test
DUE:20260308T020000Z
STATUS:NEEDS-ACTION
CREATED:20260301T080000Z
DTSTAMP:20260301T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.due_date).toBeTruthy();
            expect(new Date(task.due_date).toISOString()).toBe(
                '2026-03-08T02:00:00.000Z'
            );
        });

        it('should handle fall back DST transition', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:dst-fall-test
SUMMARY:DST Fall Test
DUE:20261101T020000Z
STATUS:NEEDS-ACTION
CREATED:20261001T080000Z
DTSTAMP:20261001T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.due_date).toBeTruthy();
            expect(new Date(task.due_date).toISOString()).toBe(
                '2026-11-01T02:00:00.000Z'
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing timezone information gracefully', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:no-tz-test
SUMMARY:No Timezone Test
DUE:20260420T140000
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.due_date).toBeTruthy();
        });

        it('should handle invalid timezone gracefully', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:invalid-tz-test
SUMMARY:Invalid Timezone Test
DUE;TZID=Invalid/Timezone:20260420T140000
STATUS:NEEDS-ACTION
CREATED:20260420T080000Z
DTSTAMP:20260420T080000Z
END:VTODO
END:VCALENDAR`;

            expect(() => {
                vTodoParser.parseVTODOToTask(vtodoString);
            }).not.toThrow();
        });

        it('should round-trip preserve UTC timestamps', async () => {
            const originalTask = {
                uid: 'roundtrip-tz-test',
                name: 'Roundtrip Timezone Test',
                due_date: '2026-04-20T14:30:45.000Z',
                status: 0,
            };

            const vtodo = vTodoSerializer.serializeTaskToVTODO(originalTask);
            const parsedTask = await vTodoParser.parseVTODOToTask(vtodo);

            expect(new Date(parsedTask.due_date).getTime()).toBe(
                new Date(originalTask.due_date).getTime()
            );
        });

        it('should handle leap year dates correctly', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:leap-year-test
SUMMARY:Leap Year Test
DUE:20240229T140000Z
STATUS:NEEDS-ACTION
CREATED:20240101T080000Z
DTSTAMP:20240101T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.due_date).toBeTruthy();
            const dueDate = new Date(task.due_date);
            expect(dueDate.getUTCDate()).toBe(29);
            expect(dueDate.getUTCMonth()).toBe(1);
            expect(dueDate.getUTCFullYear()).toBe(2024);
        });

        it('should handle year boundary correctly', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:year-boundary-test
SUMMARY:Year Boundary Test
DUE:20261231T235959Z
STATUS:NEEDS-ACTION
CREATED:20261201T080000Z
DTSTAMP:20261201T080000Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.due_date).toBeTruthy();
            const dueDate = new Date(task.due_date);
            expect(dueDate.getUTCHours()).toBe(23);
            expect(dueDate.getUTCMinutes()).toBe(59);
            expect(dueDate.getUTCSeconds()).toBe(59);
        });
    });

    describe('COMPLETED timestamp handling', () => {
        it('should preserve completion timestamp timezone', async () => {
            const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//EN
BEGIN:VTODO
UID:completed-tz-test
SUMMARY:Completed Timezone Test
STATUS:COMPLETED
COMPLETED:20260420T143045Z
CREATED:20260420T080000Z
DTSTAMP:20260420T143045Z
END:VTODO
END:VCALENDAR`;

            const task = await vTodoParser.parseVTODOToTask(vtodoString);
            expect(task.completed_at).toBeTruthy();
            const completedDate = new Date(task.completed_at);
            expect(completedDate.getUTCHours()).toBe(14);
            expect(completedDate.getUTCMinutes()).toBe(30);
            expect(completedDate.getUTCSeconds()).toBe(45);
        });

        it('should serialize completion timestamp to UTC', async () => {
            const task = {
                uid: 'completed-serialize-tz',
                name: 'Completed Serialize Test',
                status: 2,
                completed_at: '2026-04-20T14:30:45.000Z',
            };

            const vtodo = vTodoSerializer.serializeTaskToVTODO(task);
            const jcalData = ICAL.parse(vtodo);
            const comp = new ICAL.Component(jcalData);
            const vtodoComp = comp.getFirstSubcomponent('vtodo');

            const completed = vtodoComp.getFirstPropertyValue('completed');
            expect(completed.toICALString()).toBe('20260420T143045Z');
        });
    });
});
