import { TFunction } from 'i18next';
import { Task } from '../../entities/Task';
import {
    dayFraction,
    formatHabitTarget,
    isHabitCompletedInPeriod,
    isHabitDoneForNow,
    isScheduledOn,
    totalsByDay,
} from '../habitUtils';

const t = ((key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace(/{{(\w+)}}/g, (_, name) =>
        String(options?.[name])
    )) as unknown as TFunction;

const habit = (overrides: Partial<Task> = {}): Task =>
    ({
        name: 'Habit',
        habit_mode: true,
        habit_target_count: 1,
        habit_frequency_period: 'daily',
        habit_polarity: 'build',
        ...overrides,
    }) as Task;

describe('formatHabitTarget', () => {
    it('describes counts, amounts, schedules and quit habits', () => {
        expect(formatHabitTarget(t, habit({ habit_target_count: 3 }))).toBe(
            '3× a day'
        );
        expect(
            formatHabitTarget(
                t,
                habit({ habit_target_value: 20, habit_unit: 'pages' })
            )
        ).toBe('20 pages a day');
        expect(
            formatHabitTarget(
                t,
                habit({ habit_schedule_days: [1, 2, 3, 4, 5] })
            )
        ).toBe('1× a day · Weekdays');
        expect(
            formatHabitTarget(
                t,
                habit({
                    habit_frequency_period: 'interval',
                    habit_interval_days: 3,
                })
            )
        ).toBe('1× every 3 days');
        expect(formatHabitTarget(t, habit({ habit_polarity: 'quit' }))).toBe(
            'Avoid'
        );
    });
});

describe('day totals', () => {
    const entry = (day: string, extra = {}) => ({
        id: Math.random(),
        task_id: 1,
        completed_at: `${day}T12:00:00`,
        original_due_date: `${day}T12:00:00`,
        skipped: false,
        ...extra,
    });

    it('sums amounts and fills the day against the daily goal', () => {
        const h = habit({ habit_target_value: 20, habit_unit: 'pages' });
        const totals = totalsByDay(h, [
            entry('2026-09-10', { value: 5 }),
            entry('2026-09-10', { value: 5 }),
        ]);
        expect(totals.get('2026-09-10')?.progress).toBe(10);
        expect(dayFraction(h, totals.get('2026-09-10'))).toBe(0.5);
    });

    it('fills any check-in for weekly habits', () => {
        const h = habit({
            habit_frequency_period: 'weekly',
            habit_target_count: 3,
        });
        const totals = totalsByDay(h, [entry('2026-09-10')]);
        expect(dayFraction(h, totals.get('2026-09-10'))).toBe(1);
    });

    it('marks skipped days', () => {
        const totals = totalsByDay(habit(), [
            entry('2026-09-10', { skipped: true }),
        ]);
        expect(totals.get('2026-09-10')?.skipped).toBe(true);
        expect(dayFraction(habit(), totals.get('2026-09-10'))).toBe(0);
    });
});

describe('isScheduledOn', () => {
    it('respects weekday schedules on daily habits only', () => {
        const weekdays = habit({ habit_schedule_days: [1, 2, 3, 4, 5] });
        expect(isScheduledOn(weekdays, new Date(2026, 8, 12))).toBe(false); // Sat
        expect(isScheduledOn(weekdays, new Date(2026, 8, 14))).toBe(true); // Mon
    });
});

describe('isHabitCompletedInPeriod', () => {
    it('uses the server progress when present', () => {
        const progress = {
            period_start: '2026-09-10',
            period_end: '2026-09-10',
            today: '2026-09-10',
            first_day: '2026-09-01',
            progress: 2,
            check_ins: 2,
            today_check_ins: 2,
            goal: 3,
            met: false,
            skipped: false,
            scheduled_today: true,
            multiple_per_day: true,
        };
        expect(
            isHabitCompletedInPeriod(
                habit({
                    habit_progress: progress,
                    habit_last_completion_at: new Date().toISOString(),
                })
            )
        ).toBe(false);
        expect(
            isHabitCompletedInPeriod(
                habit({ habit_progress: { ...progress, met: true } })
            )
        ).toBe(true);
    });
});

describe('isHabitDoneForNow', () => {
    const progress = {
        period_start: '2026-09-07',
        period_end: '2026-09-13',
        today: '2026-09-10',
        first_day: '2026-09-01',
        progress: 1,
        check_ins: 1,
        today_check_ins: 1,
        goal: 3,
        met: false,
        skipped: false,
        scheduled_today: true,
        multiple_per_day: false,
    };

    it('counts a weekly habit checked in today before the week is met', () => {
        expect(
            isHabitDoneForNow(
                habit({
                    habit_frequency_period: 'weekly',
                    habit_target_count: 3,
                    habit_progress: progress,
                })
            )
        ).toBe(true);
    });

    it('needs the daily goal when several check-ins a day count', () => {
        expect(
            isHabitDoneForNow(
                habit({
                    habit_target_count: 3,
                    habit_progress: { ...progress, multiple_per_day: true },
                })
            )
        ).toBe(false);
    });

    it('is not done without a check-in today', () => {
        expect(
            isHabitDoneForNow(
                habit({
                    habit_frequency_period: 'weekly',
                    habit_progress: { ...progress, today_check_ins: 0 },
                })
            )
        ).toBe(false);
    });
});
