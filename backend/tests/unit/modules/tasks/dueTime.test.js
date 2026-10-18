const { Task, Notification, User } = require('../../../../models');
const {
    checkTaskReminders,
} = require('../../../../modules/tasks/taskReminderService');
const {
    applyDueTime,
    applyReminderAt,
} = require('../../../../modules/tasks/core/builders');
const {
    dueDateTimeToUTC,
    utcToUserTimeString,
} = require('../../../../utils/timezone-utils');
const bcrypt = require('bcrypt');

describe('due time', () => {
    describe('timezone helpers', () => {
        it('converts a local date and time to the matching UTC instant', () => {
            const utc = dueDateTimeToUTC(
                '2026-10-15',
                '15:30',
                'Europe/Athens'
            );
            expect(utc.toISOString()).toBe('2026-10-15T12:30:00.000Z');
        });

        it('returns null for a malformed time', () => {
            expect(dueDateTimeToUTC('2026-10-15', '25:99', 'UTC')).toBeNull();
        });

        it('formats the stored instant back as the user local time', () => {
            const utc = new Date('2026-10-15T12:30:00.000Z');
            expect(utcToUserTimeString(utc, 'Europe/Athens')).toBe('15:30');
        });
    });

    describe('applyDueTime', () => {
        const tz = 'Europe/Athens';

        it('sets a timed due date when due_date and due_time are given', () => {
            const attrs = {};
            applyDueTime(
                attrs,
                { due_date: '2026-10-15', due_time: '15:30' },
                tz
            );
            expect(attrs.due_has_time).toBe(true);
            expect(attrs.due_date.toISOString()).toBe(
                '2026-10-15T12:30:00.000Z'
            );
        });

        it('keeps end-of-day storage and clears the flag when the time is removed', () => {
            const attrs = { due_has_time: true };
            applyDueTime(
                attrs,
                { due_time: null },
                tz,
                new Date('2026-10-15T12:30:00.000Z')
            );
            expect(attrs.due_has_time).toBe(false);
            expect(utcToUserTimeString(attrs.due_date, tz)).toBe('23:59');
        });

        it('drops the time when only the date changes', () => {
            const attrs = {
                due_date: new Date('2026-10-16T20:59:59.999Z'),
                due_has_time: true,
            };
            applyDueTime(attrs, { due_date: '2026-10-16' }, tz);
            expect(attrs.due_has_time).toBe(false);
        });

        it('keeps the existing day when only the time changes', () => {
            const attrs = {};
            applyDueTime(
                attrs,
                { due_time: '09:00' },
                tz,
                new Date('2026-10-15T12:30:00.000Z')
            );
            expect(attrs.due_has_time).toBe(true);
            expect(utcToUserTimeString(attrs.due_date, tz)).toBe('09:00');
        });

        it('rejects a time that is not HH:mm', () => {
            expect(() =>
                applyDueTime(
                    {},
                    { due_date: '2026-10-15', due_time: '3pm' },
                    tz
                )
            ).toThrow('due_time must be in HH:mm format');
        });
    });

    describe('applyReminderAt', () => {
        it('re-arms the reminder when a new time is set', () => {
            const attrs = { reminder_sent_at: new Date() };
            applyReminderAt(attrs, { reminder_at: '2026-10-15T10:00:00Z' });
            expect(attrs.reminder_at).toEqual(new Date('2026-10-15T10:00:00Z'));
            expect(attrs.reminder_sent_at).toBeNull();
        });

        it('rejects an invalid date-time', () => {
            expect(() => applyReminderAt({}, { reminder_at: 'soon' })).toThrow(
                'reminder_at must be a valid date-time'
            );
        });
    });

    describe('checkTaskReminders', () => {
        let user;

        beforeEach(async () => {
            user = await User.create({
                email: 'reminder@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });
        });

        it('sends a reminder once when reminder_at has passed', async () => {
            const now = new Date('2026-10-15T10:00:00Z');
            const task = await Task.create({
                name: 'Call the bank',
                user_id: user.id,
                reminder_at: new Date('2026-10-15T09:59:00Z'),
            });

            const first = await checkTaskReminders(now);
            const second = await checkTaskReminders(now);

            expect(first.remindersSent).toBe(1);
            expect(second.remindersSent).toBe(0);

            const reloaded = await Task.findByPk(task.id);
            expect(reloaded.reminder_sent_at).not.toBeNull();

            const notifications = await Notification.findAll({
                where: { user_id: user.id, type: 'reminder' },
            });
            expect(notifications).toHaveLength(1);
        });

        it('does not send for a reminder in the future', async () => {
            await Task.create({
                name: 'Later',
                user_id: user.id,
                reminder_at: new Date('2026-10-15T12:00:00Z'),
            });

            const result = await checkTaskReminders(
                new Date('2026-10-15T10:00:00Z')
            );
            expect(result.remindersSent).toBe(0);
        });
    });
});
