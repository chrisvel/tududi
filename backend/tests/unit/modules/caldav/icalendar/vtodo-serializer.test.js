const {
    serializeTaskToVTODO,
} = require('../../../../../modules/caldav/icalendar/vtodo-serializer');
const ICAL = require('ical.js');

describe('VTODO Serializer', () => {
    const basicTask = {
        uid: 'test-task-123',
        name: 'Test Task',
        status: 0,
        priority: 1,
        note: 'Test note',
        due_date: new Date('2026-05-01T00:00:00Z'),
        created_at: new Date('2026-04-01T10:00:00Z'),
        updated_at: new Date('2026-04-14T15:00:00Z'),
    };

    it('should serialize basic task to VTODO', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toContain('BEGIN:VCALENDAR');
        expect(vtodoString).toContain('BEGIN:VTODO');
        expect(vtodoString).toContain('END:VTODO');
        expect(vtodoString).toContain('END:VCALENDAR');
    });

    it('should include required VTODO properties', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toContain('UID:test-task-123');
        expect(vtodoString).toContain('SUMMARY:Test Task');
        expect(vtodoString).toContain('DTSTAMP:');
    });

    // RFC 5545 3.8.7.2: DTSTAMP is a UTC date-time, so it ends in Z. The old
    // ICAL.Time.now() wrote the process' local time without one (#1905).
    it('should write DTSTAMP in UTC', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });

    it('should omit PRIORITY for a task with no priority', async () => {
        const noPriorityTask = { ...basicTask, priority: null };
        const undefinedPriorityTask = { ...basicTask, priority: undefined };

        expect(await serializeTaskToVTODO(noPriorityTask)).not.toContain(
            'PRIORITY'
        );
        expect(await serializeTaskToVTODO(undefinedPriorityTask)).not.toContain(
            'PRIORITY'
        );
    });

    it('should map tududi status to iCalendar STATUS', async () => {
        const tasks = [
            { ...basicTask, status: 0 },
            { ...basicTask, status: 1 },
            { ...basicTask, status: 2 },
            { ...basicTask, status: 5 },
        ];

        const statusMap = {
            0: 'NEEDS-ACTION',
            1: 'IN-PROCESS',
            2: 'COMPLETED',
            5: 'CANCELLED',
        };

        for (const task of tasks) {
            const vtodoString = await serializeTaskToVTODO(task);
            const jcalData = ICAL.parse(vtodoString);
            const comp = new ICAL.Component(jcalData);
            const vtodo = comp.getFirstSubcomponent('vtodo');
            const status = vtodo.getFirstPropertyValue('status');

            expect(status).toBe(statusMap[task.status]);
        }
    });

    it('should map tududi priority to iCalendar PRIORITY', async () => {
        const lowPriorityTask = { ...basicTask, priority: 0 };
        const mediumPriorityTask = { ...basicTask, priority: 1 };
        const highPriorityTask = { ...basicTask, priority: 2 };

        const lowVTODO = await serializeTaskToVTODO(lowPriorityTask);
        const mediumVTODO = await serializeTaskToVTODO(mediumPriorityTask);
        const highVTODO = await serializeTaskToVTODO(highPriorityTask);

        expect(lowVTODO).toContain('PRIORITY:7');
        expect(mediumVTODO).toContain('PRIORITY:5');
        expect(highVTODO).toContain('PRIORITY:3');
    });

    it('should include DESCRIPTION for task note', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toContain('DESCRIPTION:Test note');
    });

    it('should include DUE date as VALUE=DATE (no time, no UTC shift)', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toContain('DUE;VALUE=DATE:20260501');
        expect(vtodoString).not.toContain('DUE:20260501T');
    });

    it('should include DTSTART for defer_until as VALUE=DATE', async () => {
        const task = {
            ...basicTask,
            defer_until: new Date('2026-04-25T00:00:00Z'),
        };
        const vtodoString = await serializeTaskToVTODO(task);
        expect(vtodoString).toContain('DTSTART;VALUE=DATE:20260425');
        expect(vtodoString).not.toContain('DTSTART:20260425T');
    });

    it('should include VALARM with absolute TRIGGER when reminder_at is set', async () => {
        const task = {
            ...basicTask,
            reminder_at: new Date('2026-06-04T09:00:00Z'),
        };
        const vtodoString = await serializeTaskToVTODO(task);
        expect(vtodoString).toContain('BEGIN:VALARM');
        expect(vtodoString).toContain('ACTION:DISPLAY');
        expect(vtodoString).toContain('TRIGGER');
        expect(vtodoString).toContain('20260604T090000Z');
        expect(vtodoString).toContain('END:VALARM');
    });

    it('should include COMPLETED date for completed tasks', async () => {
        const task = {
            ...basicTask,
            status: 2,
            completed_at: new Date('2026-04-20T14:30:00Z'),
        };
        const vtodoString = await serializeTaskToVTODO(task);
        expect(vtodoString).toContain('COMPLETED:20260420T143000Z');
        expect(vtodoString).toContain('PERCENT-COMPLETE:100');
    });

    it('should include RRULE for recurring tasks', async () => {
        const recurringTask = {
            ...basicTask,
            recurrence_type: 'weekly',
            recurrence_weekdays: [1, 3, 5],
        };
        const vtodoString = await serializeTaskToVTODO(recurringTask);
        expect(vtodoString).toContain('RRULE:');
        expect(vtodoString).toContain('FREQ=WEEKLY');
        expect(vtodoString).toContain('BYDAY=MO,WE,FR');
    });

    it('should include RELATED-TO for subtasks', async () => {
        const subtask = {
            ...basicTask,
            parent_task_id: 1,
            ParentTask: { uid: 'parent-task-456' },
        };
        const vtodoString = await serializeTaskToVTODO(subtask);
        expect(vtodoString).toContain(
            'RELATED-TO;RELTYPE=PARENT:parent-task-456'
        );
    });

    it('should include project information as custom property', async () => {
        const task = {
            ...basicTask,
            Project: { uid: 'project-789', name: 'My Project' },
        };
        const vtodoString = await serializeTaskToVTODO(task);
        expect(vtodoString).toContain('X-TUDUDI-PROJECT-UID:project-789');
        expect(vtodoString).toContain('X-TUDUDI-PROJECT-NAME:My Project');
    });

    it('should export tags as CATEGORIES', async () => {
        const task = {
            ...basicTask,
            Tags: [
                { name: 'work', uid: 'tag-1' },
                { name: 'urgent', uid: 'tag-2' },
            ],
        };
        const vtodoString = await serializeTaskToVTODO(task);
        expect(vtodoString).toContain('CATEGORIES:work\\,urgent');
        expect(vtodoString).toContain('X-TUDUDI-TAG-UIDS:tag-1,tag-2');
    });

    it('should include habit mode custom properties', async () => {
        const habitTask = {
            ...basicTask,
            habit_mode: true,
            habit_current_streak: 5,
            habit_total_completions: 42,
        };
        const vtodoString = await serializeTaskToVTODO(habitTask);
        expect(vtodoString).toContain('X-TUDUDI-HABIT-MODE:true');
        expect(vtodoString).toContain('X-TUDUDI-HABIT-STREAK:5');
        expect(vtodoString).toContain('X-TUDUDI-HABIT-COMPLETIONS:42');
    });

    it('should include CREATED and LAST-MODIFIED timestamps', async () => {
        const vtodoString = await serializeTaskToVTODO(basicTask);
        expect(vtodoString).toContain('CREATED:20260401T100000Z');
        expect(vtodoString).toContain('LAST-MODIFIED:20260414T150000Z');
    });

    it('should handle tasks without optional fields', async () => {
        const minimalTask = {
            uid: 'minimal-task',
            name: 'Minimal Task',
            status: 0,
        };
        const vtodoString = await serializeTaskToVTODO(minimalTask);
        expect(vtodoString).toContain('BEGIN:VTODO');
        expect(vtodoString).toContain('UID:minimal-task');
        expect(vtodoString).toContain('SUMMARY:Minimal Task');
    });

    // #1928: a task with a due time keeps it on the way out; a date-only task
    // stays VALUE=DATE (#1146).
    it('should write a timed due date as a UTC DATE-TIME', async () => {
        const vtodoString = await serializeTaskToVTODO(
            {
                ...basicTask,
                due_date: new Date('2026-10-20T07:00:00Z'),
                due_has_time: true,
            },
            { userTimezone: 'Europe/Berlin' }
        );
        expect(vtodoString).toContain('DUE:20261020T070000Z');
        expect(vtodoString).not.toContain('DUE;VALUE=DATE');
    });

    it('should keep a date-only due date as VALUE=DATE', async () => {
        const vtodoString = await serializeTaskToVTODO(
            {
                ...basicTask,
                due_date: new Date('2026-10-20T21:59:59.999Z'),
                due_has_time: false,
            },
            { userTimezone: 'Europe/Berlin' }
        );
        expect(vtodoString).toContain('DUE;VALUE=DATE:20261020');
    });
});
