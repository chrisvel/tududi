'use strict';

jest.mock('../../../../models', () => ({
    RecurringCompletion: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
    },
}));

const { Op } = require('sequelize');
const { RecurringCompletion } = require('../../../../models');
const habitService = require('../../../../modules/habits/habitService');

function makeCompletion(isoDate) {
    return { completed_at: isoDate, skipped: false };
}

function makeHabit(overrides = {}) {
    return {
        id: 1,
        habit_mode: true,
        habit_frequency_period: 'weekly',
        habit_streak_mode: 'calendar',
        habit_total_completions: 0,
        habit_best_streak: 0,
        habit_current_streak: 0,
        habit_last_completion_at: null,
        update: jest.fn(),
        ...overrides,
    };
}

describe('HabitService - getPeriodStart', () => {
    it('returns midnight of the same day for daily', () => {
        const date = new Date('2026-08-06T14:30:00');
        const result = habitService.getPeriodStart('daily', date);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(7); // August
        expect(result.getDate()).toBe(6);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
    });

    it('returns the Monday of the week for weekly', () => {
        // 2026-08-06 is a Thursday
        const thursday = new Date('2026-08-06T10:00:00');
        const result = habitService.getPeriodStart('weekly', thursday);
        expect(result.getDate()).toBe(3); // Monday 2026-08-03
        expect(result.getMonth()).toBe(7);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getHours()).toBe(0);
    });

    it('handles Sunday as last day of week (not first)', () => {
        const sunday = new Date('2026-08-09T10:00:00');
        const result = habitService.getPeriodStart('weekly', sunday);
        expect(result.getDate()).toBe(3); // same week Monday
    });

    it('returns the 1st of the month for monthly', () => {
        const date = new Date('2026-08-15T10:00:00');
        const result = habitService.getPeriodStart('monthly', date);
        expect(result.getDate()).toBe(1);
        expect(result.getMonth()).toBe(7);
        expect(result.getFullYear()).toBe(2026);
    });
});

describe('HabitService - getPeriodWindow', () => {
    it('daily window spans the full day', () => {
        const date = new Date('2026-08-06T14:00:00');
        const { start, end } = habitService.getPeriodWindow('daily', date);
        expect(start.getHours()).toBe(0);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
        expect(start.getDate()).toBe(6);
        expect(end.getDate()).toBe(6);
    });

    it('weekly window spans Monday–Sunday', () => {
        const thursday = new Date('2026-08-06T10:00:00');
        const { start, end } = habitService.getPeriodWindow('weekly', thursday);
        expect(start.getDate()).toBe(3); // Monday
        expect(end.getDate()).toBe(9); // Sunday
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
    });

    it('monthly window spans the full calendar month', () => {
        const date = new Date('2026-02-15T10:00:00');
        const { start, end } = habitService.getPeriodWindow('monthly', date);
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(28); // Feb 2026 has 28 days
        expect(end.getMonth()).toBe(1);
        expect(end.getHours()).toBe(23);
    });
});

describe('HabitService - calculatePeriodStreak', () => {
    it('returns 0 for no completions', () => {
        expect(
            habitService.calculatePeriodStreak([], new Date(), 'daily')
        ).toBe(0);
    });

    it('daily: counts consecutive days', () => {
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-08-06T09:00:00'),
            makeCompletion('2026-08-05T09:00:00'),
            makeCompletion('2026-08-04T09:00:00'),
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'daily')
        ).toBe(3);
    });

    it('daily: streak breaks on gap', () => {
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-08-06T09:00:00'),
            makeCompletion('2026-08-04T09:00:00'), // gap on Aug 5
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'daily')
        ).toBe(1);
    });

    it('weekly: counts consecutive weeks', () => {
        // 2026-08-06 is Thursday, in week of Aug 3
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-08-05T09:00:00'), // this week (Aug 3–9)
            makeCompletion('2026-07-28T09:00:00'), // prev week (Jul 27 – Aug 2)
            makeCompletion('2026-07-21T09:00:00'), // week before (Jul 20–26)
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'weekly')
        ).toBe(3);
    });

    it('weekly: streak is 0 when current week has no completion', () => {
        const today = new Date('2026-08-06T10:00:00'); // week of Aug 3
        const completions = [
            makeCompletion('2026-07-28T09:00:00'), // last week only
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'weekly')
        ).toBe(0);
    });

    it('weekly: multiple completions in same week count as 1', () => {
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-08-04T09:00:00'), // Tue this week
            makeCompletion('2026-08-05T09:00:00'), // Wed this week
            makeCompletion('2026-07-28T09:00:00'), // prev week
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'weekly')
        ).toBe(2);
    });

    it('monthly: counts consecutive months', () => {
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-08-05T09:00:00'), // August
            makeCompletion('2026-07-15T09:00:00'), // July
            makeCompletion('2026-06-10T09:00:00'), // June
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'monthly')
        ).toBe(3);
    });

    it('monthly: streak is 0 when current month has no completion', () => {
        const today = new Date('2026-08-06T10:00:00');
        const completions = [
            makeCompletion('2026-07-15T09:00:00'), // last month only
        ];
        expect(
            habitService.calculatePeriodStreak(completions, today, 'monthly')
        ).toBe(0);
    });
});

describe('HabitService - calculateBestStreak', () => {
    it('returns 0 for no completions', () => {
        expect(habitService.calculateBestStreak([], 'daily')).toBe(0);
    });

    it('daily: finds the longest consecutive run', () => {
        const completions = [
            makeCompletion('2026-08-01T09:00:00'),
            makeCompletion('2026-08-02T09:00:00'),
            makeCompletion('2026-08-03T09:00:00'),
            makeCompletion('2026-08-05T09:00:00'), // gap
            makeCompletion('2026-08-06T09:00:00'),
        ];
        expect(habitService.calculateBestStreak(completions, 'daily')).toBe(3);
    });

    it('weekly: consecutive weeks form best streak', () => {
        const completions = [
            makeCompletion('2026-07-07T09:00:00'), // week of Jul 6
            makeCompletion('2026-07-14T09:00:00'), // week of Jul 13
            makeCompletion('2026-07-21T09:00:00'), // week of Jul 20
            makeCompletion('2026-08-05T09:00:00'), // week of Aug 3 (gap)
        ];
        expect(habitService.calculateBestStreak(completions, 'weekly')).toBe(3);
    });

    it('weekly: defaults to daily behavior when period not provided', () => {
        const completions = [
            makeCompletion('2026-08-01T09:00:00'),
            makeCompletion('2026-08-02T09:00:00'),
        ];
        expect(habitService.calculateBestStreak(completions)).toBe(2);
    });
});

describe('HabitService - logCompletion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        RecurringCompletion.findAll.mockResolvedValue([]);
    });

    it('rejects a non-habit task', async () => {
        const task = makeHabit({ habit_mode: false });
        await expect(habitService.logCompletion(task)).rejects.toThrow(
            'Task is not a habit'
        );
    });

    it('creates a completion when none exists yet that day', async () => {
        const task = makeHabit();
        RecurringCompletion.findOne.mockResolvedValue(null);
        RecurringCompletion.create.mockResolvedValue({ id: 1 });

        const completedAt = new Date('2026-08-04T09:00:00'); // Tue this week
        const result = await habitService.logCompletion(task, completedAt);

        expect(RecurringCompletion.create).toHaveBeenCalledWith({
            task_id: task.id,
            completed_at: completedAt,
            original_due_date: completedAt,
            skipped: false,
        });
        expect(task.update).toHaveBeenCalled();
        expect(result.completion).toEqual({ id: 1 });
    });

    it('reuses the existing completion when the same day is logged twice', async () => {
        const task = makeHabit();
        const existing = { id: 1 };
        RecurringCompletion.findOne.mockResolvedValue(existing);

        const result = await habitService.logCompletion(
            task,
            new Date('2026-08-04T09:00:00')
        );

        expect(RecurringCompletion.create).not.toHaveBeenCalled();
        expect(task.update).not.toHaveBeenCalled();
        expect(result.completion).toBe(existing);
    });

    it('allows a second completion in the same week on a different day (regression for #1421)', async () => {
        const task = makeHabit();

        // Tuesday is already completed, but Wednesday (same week) is not.
        const tuesday = new Date('2026-08-04T09:00:00');
        const wednesday = new Date('2026-08-05T09:00:00');

        RecurringCompletion.findOne.mockImplementation(({ where }) => {
            const [start, end] = where.completed_at[Op.between];
            const isTuesday = tuesday >= start && tuesday <= end;
            return Promise.resolve(isTuesday ? { id: 1 } : null);
        });
        RecurringCompletion.create.mockResolvedValue({ id: 2 });

        const result = await habitService.logCompletion(task, wednesday);

        expect(RecurringCompletion.create).toHaveBeenCalledWith({
            task_id: task.id,
            completed_at: wednesday,
            original_due_date: wednesday,
            skipped: false,
        });
        expect(result.completion).toEqual({ id: 2 });
    });

    it('queries only the clicked calendar day, not the whole frequency period', async () => {
        const task = makeHabit({ habit_frequency_period: 'weekly' });
        RecurringCompletion.findOne.mockResolvedValue(null);
        RecurringCompletion.create.mockResolvedValue({ id: 1 });

        const completedAt = new Date('2026-08-05T15:00:00'); // Wednesday
        await habitService.logCompletion(task, completedAt);

        const { where } = RecurringCompletion.findOne.mock.calls[0][0];
        const [start, end] = where.completed_at[Op.between];

        expect(start.getDate()).toBe(5);
        expect(start.getHours()).toBe(0);
        expect(end.getDate()).toBe(5);
        expect(end.getHours()).toBe(23);
    });
});

describe('HabitService - recalculateStreaks', () => {
    it('counts habit_total_completions as every logged day, not distinct periods', async () => {
        const task = makeHabit({ habit_frequency_period: 'weekly' });
        RecurringCompletion.findAll.mockResolvedValue([
            makeCompletion('2026-08-05T09:00:00'), // Wed this week
            makeCompletion('2026-08-04T09:00:00'), // Tue this week
        ]);

        const updates = await habitService.recalculateStreaks(task);

        expect(updates.habit_total_completions).toBe(2);
    });
});
