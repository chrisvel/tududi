const {
    serializeTaskToVTODO,
} = require('../../../../../modules/caldav/icalendar/vtodo-serializer');
const {
    parseVTODOToTask,
} = require('../../../../../modules/caldav/icalendar/vtodo-parser');

describe('CalDAV Round-Trip Conversion', () => {
    it('should preserve basic task data through round-trip (date-only)', async () => {
        const originalTask = {
            uid: 'round-trip-test',
            name: 'Test Round Trip',
            status: 1,
            priority: 2,
            note: 'Testing round-trip conversion',
            due_date: new Date('2026-06-01T00:00:00Z'),
            defer_until: new Date('2026-05-25T00:00:00Z'),
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(originalTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.uid).toBe(originalTask.uid);
        expect(parsedTask.name).toBe(originalTask.name);
        expect(parsedTask.status).toBe(originalTask.status);
        expect(parsedTask.priority).toBe(originalTask.priority);
        expect(parsedTask.note).toBe(originalTask.note);
        expect(parsedTask.due_date.toISOString()).toBe(
            '2026-06-01T00:00:00.000Z'
        );
        expect(parsedTask.defer_until.toISOString()).toBe(
            '2026-05-25T00:00:00.000Z'
        );
    });

    it('should collapse timed due_date to date-only through round-trip', async () => {
        const originalTask = {
            uid: 'timed-round-trip',
            name: 'Timed Task',
            status: 0,
            priority: 1,
            due_date: new Date('2026-06-04T09:00:00Z'),
            defer_until: new Date('2026-06-04T09:00:00Z'),
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(originalTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        // DUE/DTSTART are always emitted as VALUE=DATE — time is stripped
        expect(parsedTask.due_date.toISOString()).toBe(
            '2026-06-04T00:00:00.000Z'
        );
        expect(parsedTask.defer_until.toISOString()).toBe(
            '2026-06-04T00:00:00.000Z'
        );
    });

    it('should preserve iOS VALARM reminder through a note-edit round-trip', async () => {
        const iosVTODO = `BEGIN:VCALENDAR
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
UID:D4D580EE-4FAD-4E34-AF53-FFF561013D2D
END:VALARM
END:VTODO
END:VCALENDAR`;

        const parsedTask = await parseVTODOToTask(iosVTODO);
        expect(parsedTask.reminder_at).toBeInstanceOf(Date);
        expect(parsedTask.reminder_at.toISOString()).toBe(
            '2026-06-04T09:00:00.000Z'
        );

        parsedTask.note = 'Updated note via web UI';
        const reserialized = await serializeTaskToVTODO(parsedTask);

        expect(reserialized).toContain('BEGIN:VALARM');
        expect(reserialized).toContain('20260604T090000Z');

        const reparsed = await parseVTODOToTask(reserialized);
        expect(reparsed.reminder_at).toBeInstanceOf(Date);
        expect(reparsed.reminder_at.toISOString()).toBe(
            '2026-06-04T09:00:00.000Z'
        );
    });

    it('should preserve completed task data', async () => {
        const completedTask = {
            uid: 'completed-task',
            name: 'Completed Task',
            status: 2,
            priority: 1,
            completed_at: new Date('2026-04-15T10:30:00Z'),
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-15T10:30:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(completedTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.status).toBe(2);
        expect(parsedTask.completed_at.getTime()).toBe(
            completedTask.completed_at.getTime()
        );
    });

    it('should preserve recurring task data', async () => {
        const recurringTask = {
            uid: 'recurring-task',
            name: 'Weekly Meeting',
            status: 0,
            priority: 1,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekdays: [1, 3, 5],
            recurrence_end_date: new Date('2026-12-31T12:00:00Z'),
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(recurringTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.recurrence_type).toBe('weekly');
        expect(parsedTask.recurrence_interval).toBe(1);
        expect(parsedTask.recurrence_weekdays).toEqual([1, 3, 5]);
        expect(parsedTask.recurrence_end_date).toBeDefined();
        expect(parsedTask.recurrence_end_date.getFullYear()).toBe(2026);
    });

    it('should preserve monthly recurrence patterns', async () => {
        const monthlyTask = {
            uid: 'monthly-task',
            name: 'Monthly Report',
            status: 0,
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(monthlyTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.recurrence_type).toBe('monthly');
        expect(parsedTask.recurrence_month_day).toBe(15);
    });

    it('should preserve monthly weekday recurrence', async () => {
        const monthlyWeekdayTask = {
            uid: 'monthly-weekday-task',
            name: 'Second Thursday Meeting',
            status: 0,
            recurrence_type: 'monthly_weekday',
            recurrence_interval: 1,
            recurrence_week_of_month: 2,
            recurrence_weekday: 4,
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(monthlyWeekdayTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.recurrence_type).toBe('monthly_weekday');
        expect(parsedTask.recurrence_week_of_month).toBe(2);
        expect(parsedTask.recurrence_weekday).toBe(4);
    });

    it('should preserve project and tag information', async () => {
        const taskWithProject = {
            uid: 'task-with-project',
            name: 'Project Task',
            status: 0,
            Project: { uid: 'project-123', name: 'My Project' },
            Tags: [
                { uid: 'tag-1', name: 'work' },
                { uid: 'tag-2', name: 'important' },
            ],
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(taskWithProject);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.project_uid).toBe('project-123');
        expect(parsedTask.tag_names).toContain('work');
        expect(parsedTask.tag_names).toContain('important');
    });

    it('should preserve habit mode data', async () => {
        const habitTask = {
            uid: 'habit-task',
            name: 'Daily Exercise',
            status: 0,
            habit_mode: true,
            habit_current_streak: 7,
            habit_total_completions: 45,
            order: 5,
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        const vtodoString = await serializeTaskToVTODO(habitTask);
        const parsedTask = await parseVTODOToTask(vtodoString);

        expect(parsedTask.habit_mode).toBe(true);
        expect(parsedTask.habit_current_streak).toBe(7);
        expect(parsedTask.habit_total_completions).toBe(45);
        expect(parsedTask.order).toBe(5);
    });

    it('should handle multiple round-trips without data loss', async () => {
        const originalTask = {
            uid: 'multi-round-trip',
            name: 'Multiple Round Trips',
            status: 1,
            priority: 2,
            note: 'Testing multiple conversions',
            due_date: new Date('2026-07-01T12:00:00Z'),
            created_at: new Date('2026-04-01T10:00:00Z'),
            updated_at: new Date('2026-04-14T12:00:00Z'),
        };

        let task = originalTask;
        for (let i = 0; i < 3; i++) {
            const vtodoString = await serializeTaskToVTODO(task);
            task = await parseVTODOToTask(vtodoString);
        }

        expect(task.uid).toBe(originalTask.uid);
        expect(task.name).toBe(originalTask.name);
        expect(task.status).toBe(originalTask.status);
        expect(task.priority).toBe(originalTask.priority);
    });
});
