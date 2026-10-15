const {
    parseVTODOToTask,
} = require('../../../../../modules/caldav/icalendar/vtodo-parser');

describe('VTODO Parser', () => {
    const basicVTODO = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tududi//Task Manager//EN
CALSCALE:GREGORIAN
BEGIN:VTODO
UID:test-task-123
SUMMARY:Test Task
DTSTAMP:20260414T120000Z
STATUS:NEEDS-ACTION
PRIORITY:5
DESCRIPTION:Test note
DUE:20260501T120000Z
CREATED:20260401T100000Z
LAST-MODIFIED:20260414T150000Z
END:VTODO
END:VCALENDAR`;

    it('should parse basic VTODO to task', async () => {
        const task = await parseVTODOToTask(basicVTODO);
        expect(task).toBeDefined();
        expect(task.uid).toBe('test-task-123');
        expect(task.name).toBe('Test Task');
        expect(task.note).toBe('Test note');
    });

    it('should throw error for invalid VTODO string', async () => {
        await expect(parseVTODOToTask('invalid')).rejects.toThrow();
    });

    it('should throw error for VCALENDAR without VTODO', async () => {
        const invalidCalendar = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;
        await expect(parseVTODOToTask(invalidCalendar)).rejects.toThrow(
            'No VTODO component found'
        );
    });

    it('should map iCalendar STATUS to tududi status', async () => {
        const statuses = [
            { ical: 'NEEDS-ACTION', tududi: 0 },
            { ical: 'IN-PROCESS', tududi: 1 },
            { ical: 'COMPLETED', tududi: 2 },
            { ical: 'CANCELLED', tududi: 5 },
        ];

        for (const { ical, tududi } of statuses) {
            const vtodo = basicVTODO.replace(
                'STATUS:NEEDS-ACTION',
                `STATUS:${ical}`
            );
            const task = await parseVTODOToTask(vtodo);
            expect(task.status).toBe(tududi);
        }
    });

    it('should map iCalendar PRIORITY to tududi priority', async () => {
        const priorities = [
            { ical: 1, tududi: 2 },
            { ical: 3, tududi: 2 },
            { ical: 5, tududi: 1 },
            { ical: 7, tududi: 0 },
            { ical: 9, tududi: 0 },
        ];

        for (const { ical, tududi } of priorities) {
            const vtodo = basicVTODO.replace('PRIORITY:5', `PRIORITY:${ical}`);
            const task = await parseVTODOToTask(vtodo);
            expect(task.priority).toBe(tududi);
        }
    });

    it('should map iCal PRIORITY 4 to High and 0 to no priority', async () => {
        const high = basicVTODO.replace('PRIORITY:5', 'PRIORITY:4');
        expect((await parseVTODOToTask(high)).priority).toBe(2);

        const undefinedPriority = basicVTODO.replace(
            'PRIORITY:5',
            'PRIORITY:0'
        );
        expect((await parseVTODOToTask(undefinedPriority)).priority).toBeNull();

        const none = basicVTODO.replace(/PRIORITY:5\r?\n/, '');
        expect((await parseVTODOToTask(none)).priority).toBeNull();
    });

    it('should parse DUE date', async () => {
        const task = await parseVTODOToTask(basicVTODO);
        expect(task.due_date).toBeInstanceOf(Date);
        expect(task.due_date.toISOString()).toBe('2026-05-01T12:00:00.000Z');
    });

    it('should parse DTSTART as defer_until', async () => {
        const vtodo = basicVTODO.replace(
            'DUE:20260501T120000Z',
            'DTSTART:20260425T090000Z\nDUE:20260501T120000Z'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.defer_until).toBeInstanceOf(Date);
        expect(task.defer_until.toISOString()).toBe('2026-04-25T09:00:00.000Z');
    });

    // 2Do and EventKit send DTSTART together with DUE, set to the same value,
    // for a task with no start date. DTSTART on a VTODO only means "the to-do
    // starts", so that is not a defer date (#1906).
    it('should not defer a task whose DTSTART equals DUE', async () => {
        const dateOnly = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:dtstart-equals-due\r
SUMMARY:Same day\r
DTSTAMP:20261015T095140Z\r
DTSTART;VALUE=DATE:20261017\r
DUE;VALUE=DATE:20261017\r
END:VTODO\r
END:VCALENDAR`;

        const task = await parseVTODOToTask(dateOnly, 'Europe/Berlin');
        expect(task.defer_until).toBeNull();
        expect(task.due_date.toISOString()).toBe('2026-10-17T21:59:59.999Z');

        const timed = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:dtstart-equals-due-timed\r
SUMMARY:Same instant\r
DTSTAMP:20261015T095140Z\r
DTSTART:20261016T090000Z\r
DUE:20261016T090000Z\r
END:VTODO\r
END:VCALENDAR`;

        const timedTask = await parseVTODOToTask(timed, 'Europe/Berlin');
        expect(timedTask.defer_until).toBeNull();
        expect(timedTask.due_date.toISOString()).toBe(
            '2026-10-16T09:00:00.000Z'
        );
    });

    it('should keep DTSTART as defer_until when it is before DUE', async () => {
        const vtodo = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:real-defer\r
SUMMARY:Real start\r
DTSTAMP:20261015T095140Z\r
DTSTART;VALUE=DATE:20261015\r
DUE;VALUE=DATE:20261017\r
END:VTODO\r
END:VCALENDAR`;

        const task = await parseVTODOToTask(vtodo, 'Europe/Berlin');
        expect(task.defer_until.toISOString()).toBe('2026-10-14T22:00:00.000Z');
    });

    it('should parse COMPLETED date', async () => {
        const vtodo = basicVTODO.replace(
            'STATUS:NEEDS-ACTION',
            'STATUS:COMPLETED\nCOMPLETED:20260420T143000Z'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.completed_at).toBeInstanceOf(Date);
        expect(task.completed_at.toISOString()).toBe(
            '2026-04-20T14:30:00.000Z'
        );
    });

    it('should parse RRULE for recurring tasks', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\nEND:VTODO'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.recurrence_type).toBe('weekly');
        expect(task.recurrence_weekdays).toEqual([1, 3, 5]);
    });

    it('should parse RELATED-TO for subtasks', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            'RELATED-TO;RELTYPE=PARENT:parent-task-456\nEND:VTODO'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.parent_task_uid).toBe('parent-task-456');
    });

    it('should parse X-TUDUDI-PROJECT-UID custom property', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            'X-TUDUDI-PROJECT-UID:project-789\nEND:VTODO'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.project_uid).toBe('project-789');
    });

    it('should parse CATEGORIES as tags', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            'CATEGORIES:work\\,urgent\nEND:VTODO'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.tag_names).toEqual(['work', 'urgent']);
    });

    it('should parse habit mode custom properties', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            `X-TUDUDI-HABIT-MODE:true
X-TUDUDI-HABIT-STREAK:5
X-TUDUDI-HABIT-COMPLETIONS:42
END:VTODO`
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.habit_mode).toBe(true);
        expect(task.habit_current_streak).toBe(5);
        expect(task.habit_total_completions).toBe(42);
    });

    it('should parse X-TUDUDI-ORDER custom property', async () => {
        const vtodo = basicVTODO.replace(
            'END:VTODO',
            'X-TUDUDI-ORDER:10\nEND:VTODO'
        );
        const task = await parseVTODOToTask(vtodo);
        expect(task.order).toBe(10);
    });

    it('should parse VALARM with VALUE=DATE-TIME trigger to reminder_at', async () => {
        const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//iOS 17//EN
BEGIN:VTODO
DTSTART;TZID=Europe/Berlin:20260604T110000
DUE;TZID=Europe/Berlin:20260604T110000
SUMMARY:Testaufgabe
UID:byyevjtafg34nr1
DTSTAMP:20260604T080000Z
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER;VALUE=DATE-TIME:20260604T090000Z
END:VALARM
END:VTODO
END:VCALENDAR`;
        const task = await parseVTODOToTask(vtodo);
        expect(task.reminder_at).toBeInstanceOf(Date);
        expect(task.reminder_at.toISOString()).toBe('2026-06-04T09:00:00.000Z');
    });

    it('should parse VALARM with relative duration trigger to reminder_at', async () => {
        const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:test-reminder-duration
SUMMARY:Test Duration Reminder
DTSTAMP:20260414T120000Z
DUE:20260604T090000Z
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT15M
END:VALARM
END:VTODO
END:VCALENDAR`;
        const task = await parseVTODOToTask(vtodo);
        expect(task.reminder_at).toBeInstanceOf(Date);
        expect(task.reminder_at.toISOString()).toBe('2026-06-04T08:45:00.000Z');
    });

    it('should parse VALARM with zero-duration trigger to reminder_at equal to due_date', async () => {
        const vtodo = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:test-reminder-zero
SUMMARY:Test Zero Trigger
DTSTAMP:20260414T120000Z
DUE:20260604T090000Z
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT0S
END:VALARM
END:VTODO
END:VCALENDAR`;
        const task = await parseVTODOToTask(vtodo);
        expect(task.reminder_at).toBeInstanceOf(Date);
        expect(task.reminder_at.toISOString()).toBe('2026-06-04T09:00:00.000Z');
    });

    // A relative trigger runs from DTSTART (RELATED defaults to START), and a
    // DATE value means 00:00 in the user's timezone - not the 23:59:59.999 the
    // due date is stored as. PT9H on an all-day task is 09:00 that day (#1905).
    it('should measure a relative trigger from DTSTART even when DTSTART equals DUE', async () => {
        const vtodo = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:two-do-reminder\r
SUMMARY:Remindertest\r
DTSTAMP:20261015T095140Z\r
DTSTART;VALUE=DATE:20261017\r
DUE;VALUE=DATE:20261017\r
BEGIN:VALARM\r
TRIGGER;VALUE=DURATION:PT9H\r
ACTION:AUDIO\r
END:VALARM\r
END:VTODO\r
END:VCALENDAR`;

        const task = await parseVTODOToTask(vtodo, 'Europe/Berlin');
        expect(task.reminder_at.toISOString()).toBe('2026-10-17T07:00:00.000Z');
    });

    it('should measure a relative RELATED=END trigger from the due date', async () => {
        const vtodo = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:related-end\r
SUMMARY:Alarm before the due date\r
DTSTAMP:20261015T095140Z\r
DTSTART;VALUE=DATE:20261007\r
DUE;VALUE=DATE:20261017\r
BEGIN:VALARM\r
TRIGGER;RELATED=END;VALUE=DURATION:-PT1H\r
ACTION:DISPLAY\r
END:VALARM\r
END:VTODO\r
END:VCALENDAR`;

        const task = await parseVTODOToTask(vtodo, 'Europe/Berlin');
        expect(task.reminder_at.toISOString()).toBe('2026-10-17T20:59:59.999Z');
    });

    it('should handle VTODO without optional properties', async () => {
        const minimalVTODO = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:minimal-task
SUMMARY:Minimal Task
DTSTAMP:20260414T120000Z
END:VTODO
END:VCALENDAR`;

        const task = await parseVTODOToTask(minimalVTODO);
        expect(task.uid).toBe('minimal-task');
        expect(task.name).toBe('Minimal Task');
        expect(task.status).toBe(0);
        expect(task.recurrence_type).toBe('none');
    });
});
