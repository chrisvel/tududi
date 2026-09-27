'use strict';

const habitsRepository = require('./repository');
const habitService = require('./habitService');
const { PERIODS } = require('./habitEngine');
const { NotFoundError, ValidationError } = require('../../shared/errors');

const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'];
const POLARITIES = ['build', 'quit'];
const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function nullable(value) {
    return value === undefined || value === null || value === '';
}

function positiveInt(value, field, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max) {
        throw new ValidationError(`${field} must be a whole number 1-${max}`);
    }
    return number;
}

// Only habit settings are writable through the habits API.
function pickHabitFields(data = {}) {
    const fields = {};

    if (data.name !== undefined) {
        const name = String(data.name || '').trim();
        if (!name) throw new ValidationError('Habit name is required');
        fields.name = name.slice(0, 255);
    }
    if (data.note !== undefined) {
        fields.note = nullable(data.note) ? null : String(data.note);
    }
    if ([0, 1, 2].includes(data.priority)) {
        fields.priority = data.priority;
    }
    if (data.habit_polarity !== undefined) {
        if (!POLARITIES.includes(data.habit_polarity)) {
            throw new ValidationError('Invalid habit type');
        }
        fields.habit_polarity = data.habit_polarity;
    }
    if (data.habit_frequency_period !== undefined) {
        if (!PERIODS.includes(data.habit_frequency_period)) {
            throw new ValidationError('Invalid habit frequency');
        }
        fields.habit_frequency_period = data.habit_frequency_period;
    }
    if (data.habit_target_count !== undefined) {
        fields.habit_target_count = nullable(data.habit_target_count)
            ? 1
            : positiveInt(data.habit_target_count, 'Target count', 1000);
    }
    if (data.habit_target_value !== undefined) {
        if (nullable(data.habit_target_value)) {
            fields.habit_target_value = null;
        } else {
            const value = Number(data.habit_target_value);
            if (!Number.isFinite(value) || value <= 0) {
                throw new ValidationError('Target amount must be positive');
            }
            fields.habit_target_value = value;
        }
    }
    if (data.habit_unit !== undefined) {
        fields.habit_unit = nullable(data.habit_unit)
            ? null
            : String(data.habit_unit).trim().slice(0, 20) || null;
    }
    if (data.habit_schedule_days !== undefined) {
        if (nullable(data.habit_schedule_days)) {
            fields.habit_schedule_days = null;
        } else {
            const days = data.habit_schedule_days;
            if (
                !Array.isArray(days) ||
                days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
            ) {
                throw new ValidationError('Schedule days must be 0-6');
            }
            const unique = [...new Set(days)].sort();
            if (unique.length === 0) {
                throw new ValidationError('Pick at least one day');
            }
            fields.habit_schedule_days = unique.length === 7 ? null : unique;
        }
    }
    if (data.habit_interval_days !== undefined) {
        fields.habit_interval_days = nullable(data.habit_interval_days)
            ? null
            : Math.max(
                  2,
                  positiveInt(data.habit_interval_days, 'Interval', 365)
              );
    }
    if (data.habit_time_of_day !== undefined) {
        if (
            !nullable(data.habit_time_of_day) &&
            !TIMES_OF_DAY.includes(data.habit_time_of_day)
        ) {
            throw new ValidationError('Invalid time of day');
        }
        fields.habit_time_of_day = nullable(data.habit_time_of_day)
            ? null
            : data.habit_time_of_day;
    }
    if (data.habit_reminder_time !== undefined) {
        if (
            !nullable(data.habit_reminder_time) &&
            !REMINDER_TIME.test(data.habit_reminder_time)
        ) {
            throw new ValidationError('Reminder time must be HH:MM');
        }
        fields.habit_reminder_time = nullable(data.habit_reminder_time)
            ? null
            : data.habit_reminder_time;
        fields.habit_reminder_sent_on = null;
    }
    if (data.habit_color !== undefined) {
        if (
            !nullable(data.habit_color) &&
            !HEX_COLOR.test(String(data.habit_color))
        ) {
            throw new ValidationError('Color must be a hex value');
        }
        fields.habit_color = nullable(data.habit_color)
            ? null
            : String(data.habit_color).toLowerCase();
    }
    // Kept for older clients; streaks no longer depend on them.
    if (['calendar', 'scheduled'].includes(data.habit_streak_mode)) {
        fields.habit_streak_mode = data.habit_streak_mode;
    }
    if (['flexible', 'strict'].includes(data.habit_flexibility_mode)) {
        fields.habit_flexibility_mode = data.habit_flexibility_mode;
    }

    return fields;
}

function serialize(habit, evaluation) {
    const plain = habit.get ? habit.get({ plain: true }) : { ...habit };
    if (evaluation) plain.habit_progress = evaluation.progress;
    plain.habit_archived = habitService.isInactive(habit);
    return plain;
}

class HabitsService {
    async loadHabit(userId, uid) {
        const habit = await habitsRepository.findByUidAndUser(uid, userId);
        if (!habit || !habit.habit_mode) {
            throw new NotFoundError('Habit not found');
        }
        return habit;
    }

    async getAll(userId, { archived = false } = {}) {
        const habits = await habitsRepository.findAllByUser(userId, {
            archived,
        });
        const ctx = await habitService.getUserContext(userId);
        const evaluations = await habitService.refreshMany(habits, ctx);
        return {
            habits: habits.map((h) => serialize(h, evaluations.get(h.id))),
        };
    }

    async getOne(userId, uid) {
        const habit = await this.loadHabit(userId, uid);
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return { habit: serialize(habit, evaluation) };
    }

    async create(userId, data) {
        const fields = pickHabitFields(data);
        if (!fields.name) throw new ValidationError('Habit name is required');
        const habit = await habitsRepository.createHabit(userId, {
            habit_target_count: 1,
            habit_frequency_period: 'daily',
            recurrence_type: 'daily',
            recurrence_interval: 1,
            ...fields,
        });
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return { habit: serialize(habit, evaluation) };
    }

    async logCompletion(userId, uid, body = {}) {
        const habit = await this.loadHabit(userId, uid);
        const ctx = await habitService.getUserContext(userId);
        const result = await habitService.logCompletion(habit, ctx, {
            completedAt: body.completed_at,
            value: body.value,
            note: body.note,
        });
        return {
            completion: result.completion,
            task: serialize(result.task, result.evaluation),
        };
    }

    async skipDay(userId, uid, body = {}) {
        const habit = await this.loadHabit(userId, uid);
        const ctx = await habitService.getUserContext(userId);
        const result = await habitService.skipDay(habit, ctx, {
            date: body.date,
            note: body.note,
        });
        return {
            completion: result.completion,
            task: serialize(result.task, result.evaluation),
        };
    }

    async getCompletions(userId, uid, startDate, endDate) {
        const habit = await this.loadHabit(userId, uid);
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

    async updateCompletion(userId, uid, completionId, data = {}) {
        const habit = await this.loadHabit(userId, uid);
        const completion = await habitsRepository.findCompletionById(
            completionId,
            habit.id
        );
        if (!completion) throw new NotFoundError('Completion not found');
        await habitService.updateEntry(completion, data);
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return { completion, task: serialize(habit, evaluation) };
    }

    async deleteCompletion(userId, uid, completionId) {
        const habit = await this.loadHabit(userId, uid);
        const completion = await habitsRepository.findCompletionById(
            completionId,
            habit.id
        );
        if (!completion) {
            throw new NotFoundError('Completion not found');
        }
        await completion.destroy();
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return {
            message: 'Completion deleted',
            task: serialize(habit, evaluation),
        };
    }

    async getStats(userId, uid, startDate, endDate) {
        const habit = await this.loadHabit(userId, uid);
        const start = startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        const ctx = await habitService.getUserContext(userId);
        return habitService.getHabitStats(habit, ctx, start, end);
    }

    async update(userId, uid, data) {
        const habit = await this.loadHabit(userId, uid);
        const fields = pickHabitFields(data);
        await habitsRepository.update(habit, fields);
        // Settings such as the target or schedule can move streaks, so the
        // cached counters are rebuilt on every update.
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return { habit: serialize(habit, evaluation) };
    }

    async setArchived(userId, uid, archived) {
        const habit = await this.loadHabit(userId, uid);
        await habitsRepository.update(habit, {
            status: archived
                ? habitService.ARCHIVED_STATUS
                : habit.habit_total_completions > 0
                  ? 2
                  : 0,
        });
        const ctx = await habitService.getUserContext(userId);
        const evaluation = await habitService.refresh(habit, ctx);
        return { habit: serialize(habit, evaluation) };
    }

    async delete(userId, uid) {
        const habit = await this.loadHabit(userId, uid);
        await habitsRepository.destroy(habit);
        return { message: 'Habit deleted' };
    }
}

module.exports = new HabitsService();
module.exports.pickHabitFields = pickHabitFields;
