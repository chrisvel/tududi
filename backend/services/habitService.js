const { RecurringCompletion } = require('../models');
const { Op } = require('sequelize');

class HabitService {
    /**
     * Log a habit completion
     * Updates streak counters and creates completion record
     */
    async logCompletion(task, completedAt = new Date()) {
        if (!task.habit_mode) {
            throw new Error('Task is not a habit');
        }

        const completion = await RecurringCompletion.create({
            task_id: task.id,
            completed_at: completedAt,
            original_due_date: completedAt, // For habits, due date = completion date
            skipped: false,
        });

        // Update cached counters and mark as done for today
        const updates = await this.calculateStreakUpdates(task, completedAt);
        updates.status = 2; // Mark as done
        updates.completed_at = completedAt;
        await task.update(updates);

        return { completion, task };
    }

    /**
     * Calculate streak updates based on completion
     * This is the core habit logic
     */
    async calculateStreakUpdates(task, completedAt) {
        const updates = {
            habit_total_completions: task.habit_total_completions + 1,
            habit_last_completion_at: completedAt,
        };

        // Calculate new streak
        const newStreak = await this.calculateCurrentStreak(task, completedAt);
        updates.habit_current_streak = newStreak;

        // Update best streak if needed
        if (newStreak > task.habit_best_streak) {
            updates.habit_best_streak = newStreak;
        }

        return updates;
    }

    /**
     * Recalculate all streak values after a completion is deleted
     */
    async recalculateStreaks(task) {
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                skipped: false,
            },
            order: [['completed_at', 'DESC']],
        });

        const updates = {
            habit_total_completions: completions.length,
            habit_last_completion_at:
                completions.length > 0 ? completions[0].completed_at : null,
        };

        // Calculate current streak
        updates.habit_current_streak =
            completions.length > 0
                ? this.calculateCalendarStreak(completions, new Date())
                : 0;

        // Calculate best streak (need to check all possible streaks)
        updates.habit_best_streak = this.calculateBestStreak(completions);

        return updates;
    }

    /**
     * Calculate the best (longest) streak from completion history
     */
    calculateBestStreak(completions) {
        if (completions.length === 0) return 0;

        let bestStreak = 0;
        let currentStreak = 0;
        let lastDate = null;

        // Sort by date ascending for this calculation
        const sorted = [...completions].sort(
            (a, b) => new Date(a.completed_at) - new Date(b.completed_at)
        );

        for (const completion of sorted) {
            const completedDate = new Date(completion.completed_at);
            completedDate.setHours(0, 0, 0, 0);

            if (!lastDate) {
                currentStreak = 1;
            } else {
                const diffDays = Math.floor(
                    (completedDate - lastDate) / (1000 * 60 * 60 * 24)
                );

                if (diffDays === 1) {
                    // Consecutive day
                    currentStreak++;
                } else if (diffDays === 0) {
                    // Same day, don't change streak
                    continue;
                } else {
                    // Streak broken
                    bestStreak = Math.max(bestStreak, currentStreak);
                    currentStreak = 1;
                }
            }

            lastDate = new Date(completedDate);
        }

        return Math.max(bestStreak, currentStreak);
    }

    /**
     * Calculate current streak based on streak mode
     */
    async calculateCurrentStreak(task, asOfDate = new Date()) {
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                skipped: false,
            },
            order: [['completed_at', 'DESC']],
        });

        if (completions.length === 0) return 0;

        if (task.habit_streak_mode === 'calendar') {
            return this.calculateCalendarStreak(completions, asOfDate);
        } else {
            return this.calculateScheduledStreak(task, completions, asOfDate);
        }
    }

    /**
     * Calendar streak: consecutive days with completions
     */
    calculateCalendarStreak(completions, asOfDate) {
        let streak = 0;
        let currentDate = new Date(asOfDate);
        currentDate.setHours(0, 0, 0, 0);

        const completionDates = completions.map((c) => {
            const d = new Date(c.completed_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        });

        const uniqueDates = [...new Set(completionDates)].sort((a, b) => b - a);

        for (const dateTimestamp of uniqueDates) {
            const expectedDate = currentDate.getTime();
            if (dateTimestamp === expectedDate) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (dateTimestamp < expectedDate) {
                break; // Gap in streak
            }
        }

        return streak;
    }

    /**
     * Scheduled streak: consecutive scheduled occurrences completed
     * Uses recurrence pattern to determine expected dates
     */
    calculateScheduledStreak(task, completions, asOfDate) {
        // Implementation depends on recurrence pattern
        // For MVP: simplified version - count consecutive scheduled periods with completions
        // Full implementation would use recurringTaskService to calculate expected dates

        // Simplified: treat as calendar streak for now
        // TODO: Implement full scheduled streak logic in Phase 2
        return this.calculateCalendarStreak(completions, asOfDate);
    }

    /**
     * Get habit statistics for a period
     */
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

        // Calculate completion rate if target is set
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

    /**
     * Calculate target completions for a date range
     */
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

    /**
     * Check if habit is due today based on flexibility mode
     */
    isDueToday(task, today = new Date()) {
        if (task.habit_flexibility_mode === 'flexible') {
            // Flexible: always available
            return true;
        } else {
            // Strict: check if today matches recurrence pattern
            // Leverage existing recurringTaskService logic
            const { calculateNextDueDate } = require('./recurringTaskService');
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
