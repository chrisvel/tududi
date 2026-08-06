'use strict';

jest.mock('../../../../models', () => ({
    RecurringCompletion: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
    },
}));

const habitService = require('../../../../modules/habits/habitService');

function makeCompletion(isoDate) {
    return { completed_at: isoDate, skipped: false };
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
