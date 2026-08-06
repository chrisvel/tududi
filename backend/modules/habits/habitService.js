'use strict';

const { RecurringCompletion } = require('../../models');
const { Op } = require('sequelize');

class HabitService {
    async logCompletion(task, completedAt = new Date()) {
        if (!task.habit_mode) {
            throw new Error('Task is not a habit');
        }

        const period = task.habit_frequency_period || 'daily';
        const { start: periodStart, end: periodEnd } = this.getPeriodWindow(
            period,
            completedAt
        );

        const existingInPeriod = await RecurringCompletion.findOne({
            where: {
                task_id: task.id,
                skipped: false,
                completed_at: { [Op.between]: [periodStart, periodEnd] },
            },
        });

        if (existingInPeriod) {
            return { completion: existingInPeriod, task };
        }

        const completion = await RecurringCompletion.create({
            task_id: task.id,
            completed_at: completedAt,
            original_due_date: completedAt,
            skipped: false,
        });

        // Update cached counters and mark as done for the period
        const updates = await this.calculateStreakUpdates(task, completedAt);
        updates.status = 2; // Mark as done
        updates.completed_at = completedAt;
        await task.update(updates);

        return { completion, task };
    }

    // Returns the start of the period (Monday for weekly, 1st for monthly, midnight for daily)
    getPeriodStart(period, date) {
        const d = new Date(date);
        if (period === 'weekly') {
            const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const diff = day === 0 ? -6 : 1 - day; // back to Monday
            d.setDate(d.getDate() + diff);
        } else if (period === 'monthly') {
            d.setDate(1);
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Returns the start of the previous period
    getPreviousPeriodStart(period, periodStart) {
        const d = new Date(periodStart);
        if (period === 'weekly') {
            d.setDate(d.getDate() - 7);
        } else if (period === 'monthly') {
            d.setMonth(d.getMonth() - 1);
        } else {
            d.setDate(d.getDate() - 1);
        }
        return d;
    }

    // Returns the start of the next period (used for best-streak calculation)
    getNextPeriodStart(period, periodStart) {
        const d = new Date(periodStart);
        if (period === 'weekly') {
            d.setDate(d.getDate() + 7);
        } else if (period === 'monthly') {
            d.setMonth(d.getMonth() + 1);
        } else {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }

    // Returns {start, end} bounding the entire period that contains asOfDate
    getPeriodWindow(period, asOfDate) {
        const start = this.getPeriodStart(period, asOfDate);
        const end = new Date(start);
        if (period === 'weekly') {
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'monthly') {
            end.setMonth(start.getMonth() + 1, 0); // last day of current month
            end.setHours(23, 59, 59, 999);
        } else {
            end.setHours(23, 59, 59, 999);
        }
        return { start, end };
    }

    // Current streak: consecutive periods (counting backward from asOfDate) each with ≥1 completion
    calculatePeriodStreak(completions, asOfDate, period) {
        if (!completions.length) return 0;

        const completionPeriods = new Set(
            completions.map((c) =>
                this.getPeriodStart(period, new Date(c.completed_at)).getTime()
            )
        );

        let streak = 0;
        let current = this.getPeriodStart(period, asOfDate);

        while (completionPeriods.has(current.getTime())) {
            streak++;
            current = this.getPreviousPeriodStart(period, current);
        }

        return streak;
    }

    async calculateStreakUpdates(task, completedAt) {
        const updates = {
            habit_total_completions: task.habit_total_completions + 1,
            habit_last_completion_at: completedAt,
        };

        const newStreak = await this.calculateCurrentStreak(task, completedAt);
        updates.habit_current_streak = newStreak;

        if (newStreak > task.habit_best_streak) {
            updates.habit_best_streak = newStreak;
        }

        return updates;
    }

    async recalculateStreaks(task) {
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                skipped: false,
            },
            order: [['completed_at', 'DESC']],
        });

        const period = task.habit_frequency_period || 'daily';

        const distinctPeriods = new Set(
            completions.map((c) =>
                this.getPeriodStart(period, new Date(c.completed_at)).getTime()
            )
        ).size;

        const updates = {
            habit_total_completions: distinctPeriods,
            habit_last_completion_at:
                completions.length > 0 ? completions[0].completed_at : null,
        };

        updates.habit_current_streak =
            completions.length > 0
                ? this.calculatePeriodStreak(completions, new Date(), period)
                : 0;

        updates.habit_best_streak = this.calculateBestStreak(
            completions,
            period
        );

        return updates;
    }

    // Best streak ever achieved: longest run of consecutive completed periods
    calculateBestStreak(completions, period = 'daily') {
        if (completions.length === 0) return 0;

        // Normalize to period starts and deduplicate, sorted ascending
        const periodStarts = [
            ...new Set(
                completions.map((c) =>
                    this.getPeriodStart(
                        period,
                        new Date(c.completed_at)
                    ).getTime()
                )
            ),
        ].sort((a, b) => a - b);

        let bestStreak = 0;
        let currentStreak = 0;
        let lastPeriodStart = null;

        for (const ts of periodStarts) {
            const current = new Date(ts);
            if (!lastPeriodStart) {
                currentStreak = 1;
            } else {
                const expectedNext = this.getNextPeriodStart(
                    period,
                    lastPeriodStart
                );
                if (current.getTime() === expectedNext.getTime()) {
                    currentStreak++;
                } else {
                    bestStreak = Math.max(bestStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            lastPeriodStart = current;
        }

        return Math.max(bestStreak, currentStreak);
    }

    async calculateCurrentStreak(task, asOfDate = new Date()) {
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                skipped: false,
            },
            order: [['completed_at', 'DESC']],
        });

        if (completions.length === 0) return 0;

        const period = task.habit_frequency_period || 'daily';

        if (task.habit_streak_mode === 'calendar') {
            return this.calculatePeriodStreak(completions, asOfDate, period);
        } else {
            return this.calculateScheduledStreak(task, completions, asOfDate);
        }
    }

    // Calendar streak delegates to period-aware implementation
    calculateCalendarStreak(completions, asOfDate) {
        return this.calculatePeriodStreak(completions, asOfDate, 'daily');
    }

    // Scheduled streak uses the task's frequency period
    calculateScheduledStreak(task, completions, asOfDate) {
        const period = task.habit_frequency_period || 'daily';
        return this.calculatePeriodStreak(completions, asOfDate, period);
    }

    async getHabitStats(task, startDate, endDate) {
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                completed_at: {
                    [Op.between]: [startDate, endDate],
                },
                skipped: false,
            },
            order: [['completed_at', 'ASC']],
        });

        const totalCompletions = completions.length;
        const currentStreak = task.habit_current_streak;

        let completionRate = null;
        if (task.habit_target_count && task.habit_frequency_period) {
            const target = this.calculatePeriodTarget(task, startDate, endDate);
            completionRate = target > 0 ? (totalCompletions / target) * 100 : 0;
        }

        return {
            totalCompletions,
            currentStreak,
            bestStreak: task.habit_best_streak,
            completionRate,
            completions: completions.map((c) => ({
                completed_at: c.completed_at,
                id: c.id,
            })),
        };
    }

    calculatePeriodTarget(task, startDate, endDate) {
        if (!task.habit_target_count || !task.habit_frequency_period) {
            return 0;
        }

        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        switch (task.habit_frequency_period) {
            case 'daily':
                return task.habit_target_count * days;
            case 'weekly':
                return task.habit_target_count * Math.ceil(days / 7);
            case 'monthly':
                return task.habit_target_count * Math.ceil(days / 30);
            default:
                return 0;
        }
    }

    isDueToday(task, today = new Date()) {
        if (task.habit_flexibility_mode === 'flexible') {
            return true;
        } else {
            const {
                calculateNextDueDate,
            } = require('../tasks/recurringTaskService');
            const nextDue = calculateNextDueDate(
                task,
                task.habit_last_completion_at || task.created_at
            );

            if (!nextDue) return false;

            const todayStart = new Date(today);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);

            return nextDue >= todayStart && nextDue <= todayEnd;
        }
    }
}

module.exports = new HabitService();
