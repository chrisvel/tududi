'use strict';

const engine = require('../../../../modules/habits/habitEngine');

const TZ = 'Europe/Athens';
const ctx = (now, extra = {}) => ({
    timezone: TZ,
    firstDayOfWeek: 1,
    now: new Date(now),
    ...extra,
});

function habit(overrides = {}) {
    return {
        habit_frequency_period: 'daily',
        habit_target_count: 1,
        habit_polarity: 'build',
        created_at: '2026-09-01T08:00:00Z',
        ...overrides,
    };
}

// Local noon in Athens (UTC+3 in September).
const at = (day, hour = 12) =>
    `${day}T${String(hour - 3).padStart(2, '0')}:00:00Z`;
const done = (day, extra = {}) => ({
    completed_at: at(day),
    skipped: false,
    ...extra,
});
const skip = (day) => ({ completed_at: at(day), skipped: true });

describe('habitEngine - day keys', () => {
    it('uses the user timezone, not the server clock', () => {
        // 23:30 in Athens on the 10th is 20:30 UTC.
        expect(engine.toDayKey('2026-09-10T20:30:00Z', TZ)).toBe('2026-09-10');
        // 00:30 in Athens on the 11th is still the 10th in UTC.
        expect(engine.toDayKey('2026-09-10T21:30:00Z', TZ)).toBe('2026-09-11');
    });

    it('starts weeks on the configured first day', () => {
        const cfg = engine.normalizeConfig(
            habit({ habit_frequency_period: 'weekly' }),
            { timezone: TZ, firstDayOfWeek: 0 }
        );
        // 2026-09-10 is a Thursday; the Sunday before is the 6th.
        expect(engine.periodStart('2026-09-10', cfg)).toBe('2026-09-06');
        expect(engine.periodEnd('2026-09-06', cfg)).toBe('2026-09-12');
    });

    it('uses calendar months', () => {
        const cfg = engine.normalizeConfig(
            habit({ habit_frequency_period: 'monthly' }),
            { timezone: TZ }
        );
        expect(engine.periodStart('2026-02-17', cfg)).toBe('2026-02-01');
        expect(engine.periodEnd('2026-02-01', cfg)).toBe('2026-02-28');
    });

    it('anchors interval periods on the creation day', () => {
        const cfg = engine.normalizeConfig(
            habit({
                habit_frequency_period: 'interval',
                habit_interval_days: 3,
            }),
            { timezone: TZ }
        );
        expect(engine.periodStart('2026-09-01', cfg)).toBe('2026-09-01');
        expect(engine.periodStart('2026-09-03', cfg)).toBe('2026-09-01');
        expect(engine.periodStart('2026-09-04', cfg)).toBe('2026-09-04');
        expect(engine.periodStart('2026-08-31', cfg)).toBe('2026-08-29');
    });
});

describe('habitEngine - build streaks', () => {
    it("keeps yesterday's streak while today is still open", () => {
        const result = engine.evaluate(
            habit(),
            [done('2026-09-08'), done('2026-09-09'), done('2026-09-10')],
            ctx(at('2026-09-11', 9))
        );
        expect(result.currentStreak).toBe(3);
        expect(result.progress.met).toBe(false);
    });

    it('counts today once it is done', () => {
        const result = engine.evaluate(
            habit(),
            [done('2026-09-09'), done('2026-09-10'), done('2026-09-11')],
            ctx(at('2026-09-11', 18))
        );
        expect(result.currentStreak).toBe(3);
        expect(result.progress.met).toBe(true);
    });

    it('breaks on a missed day and keeps the best streak', () => {
        const result = engine.evaluate(
            habit(),
            [
                done('2026-09-02'),
                done('2026-09-03'),
                done('2026-09-04'),
                done('2026-09-06'),
            ],
            ctx(at('2026-09-06', 20))
        );
        expect(result.currentStreak).toBe(1);
        expect(result.bestStreak).toBe(3);
    });

    it('does not break a streak on a skipped day', () => {
        const result = engine.evaluate(
            habit(),
            [done('2026-09-08'), skip('2026-09-09'), done('2026-09-10')],
            ctx(at('2026-09-10', 20))
        );
        expect(result.currentStreak).toBe(2);
        expect(result.totalCompletions).toBe(2);
    });

    it('ignores days that are not on the schedule', () => {
        // Weekdays only; 2026-09-12/13 is a weekend.
        const result = engine.evaluate(
            habit({ habit_schedule_days: [1, 2, 3, 4, 5] }),
            [done('2026-09-10'), done('2026-09-11'), done('2026-09-14')],
            ctx(at('2026-09-14', 20))
        );
        expect(result.currentStreak).toBe(3);
    });

    it('needs every check-in for a multi-count daily goal', () => {
        const h = habit({ habit_target_count: 3 });
        const partial = engine.evaluate(
            h,
            [
                done('2026-09-09'),
                done('2026-09-09'),
                done('2026-09-09'),
                done('2026-09-10'),
            ],
            ctx(at('2026-09-11', 9))
        );
        expect(partial.currentStreak).toBe(0);
        expect(partial.bestStreak).toBe(1);

        const today = engine.evaluate(
            h,
            [done('2026-09-11'), done('2026-09-11')],
            ctx(at('2026-09-11', 20))
        );
        expect(today.progress.progress).toBe(2);
        expect(today.progress.goal).toBe(3);
        expect(today.progress.met).toBe(false);
        expect(today.progress.multiple_per_day).toBe(true);
    });

    it('counts weekly streaks in weeks', () => {
        const h = habit({
            habit_frequency_period: 'weekly',
            habit_target_count: 2,
        });
        const result = engine.evaluate(
            h,
            [
                done('2026-09-01'),
                done('2026-09-03'),
                done('2026-09-08'),
                done('2026-09-10'),
            ],
            ctx(at('2026-09-15', 9))
        );
        expect(result.currentStreak).toBe(2);
        expect(result.progress.period_start).toBe('2026-09-14');
        expect(result.progress.multiple_per_day).toBe(false);
    });

    it('sums amounts for measurable habits', () => {
        const h = habit({ habit_target_value: 20, habit_unit: 'pages' });
        const result = engine.evaluate(
            h,
            [
                done('2026-09-10', { value: 12 }),
                done('2026-09-10', { value: 10 }),
                done('2026-09-11', { value: 5 }),
            ],
            ctx(at('2026-09-11', 20))
        );
        expect(result.currentStreak).toBe(1);
        expect(result.progress.progress).toBe(5);
        expect(result.progress.goal).toBe(20);
    });
});

describe('habitEngine - quit habits', () => {
    const quit = habit({ habit_polarity: 'quit' });

    it('counts clean days from the start, including today', () => {
        const result = engine.evaluate(quit, [], ctx(at('2026-09-05', 9)));
        expect(result.currentStreak).toBe(5);
        expect(result.progress.met).toBe(true);
    });

    it('resets on a slip and keeps the best run', () => {
        const result = engine.evaluate(
            quit,
            [done('2026-09-04')],
            ctx(at('2026-09-07', 9))
        );
        expect(result.bestStreak).toBe(3);
        expect(result.currentStreak).toBe(3);
        expect(result.totalCompletions).toBe(1);
    });

    it('marks today failed after a slip today', () => {
        const result = engine.evaluate(
            quit,
            [done('2026-09-07')],
            ctx(at('2026-09-07', 20))
        );
        expect(result.currentStreak).toBe(0);
        expect(result.progress.met).toBe(false);
    });
});

describe('habitEngine - strength', () => {
    it('grows with repetitions and decays slowly after a miss', () => {
        const days = Array.from({ length: 30 }, (_, i) =>
            done(engine.addDays('2026-09-01', i))
        );
        const strong = engine.evaluate(
            habit(),
            days,
            ctx(at('2026-09-30', 20))
        );
        expect(strong.strength).toBeGreaterThan(70);

        const missed = engine.evaluate(
            habit(),
            days.slice(0, 28),
            ctx(at('2026-09-30', 20))
        );
        expect(missed.strength).toBeLessThan(strong.strength);
        expect(missed.strength).toBeGreaterThan(60);
        expect(missed.currentStreak).toBe(0);
    });

    it('does not penalise the open current period', () => {
        const a = engine.evaluate(
            habit(),
            [done('2026-09-01')],
            ctx(at('2026-09-02', 9))
        );
        const b = engine.evaluate(
            habit(),
            [done('2026-09-01')],
            ctx(at('2026-09-01', 20))
        );
        expect(a.strength).toBe(b.strength);
    });
});
