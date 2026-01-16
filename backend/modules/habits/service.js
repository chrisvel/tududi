'use strict';

const habitsRepository = require('./repository');
const habitService = require('./habitService');
const { NotFoundError } = require('../../shared/errors');

class HabitsService {
    async getAll(userId) {
        const habits = await habitsRepository.findAllByUser(userId);
        return { habits };
    }

    async create(userId, data) {
        const habit = await habitsRepository.createHabit(userId, data);
        return { habit };
    }

    async logCompletion(userId, uid, completedAt) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        const result = await habitService.logCompletion(
            habit,
            completedAt ? new Date(completedAt) : new Date()
        );
        return result;
    }

    async getCompletions(userId, uid, startDate, endDate) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        const start = startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        const completions = await habitsRepository.findCompletions(
            habit.id,
            start,
            end
        );
        return { completions };
    }

    async deleteCompletion(userId, uid, completionId) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        const completion = await habitsRepository.findCompletionById(
            completionId,
            habit.id
        );
        if (!completion) {
            throw new NotFoundError('Completion not found');
        }
        await completion.destroy();
        const updates = await habitService.recalculateStreaks(habit);
        await habitsRepository.update(habit, updates);
        return { message: 'Completion deleted', task: habit };
    }

    async getStats(userId, uid, startDate, endDate) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        const start = startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        return habitService.getHabitStats(habit, start, end);
    }

    async update(userId, uid, data) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        await habitsRepository.update(habit, data);
        return { habit };
    }

    async delete(userId, uid) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        await habitsRepository.destroy(habit);
        return { message: 'Habit deleted' };
    }
}

module.exports = new HabitsService();
