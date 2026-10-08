'use strict';

const { RecurringCompletion, User } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const engine = require('./habitEngine');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const { ValidationError } = require('../../shared/errors');

const ARCHIVED_STATUS = 3;
const CANCELLED_STATUS = 5;

function isInactive(task) {
    return task.status === ARCHIVED_STATUS || task.status === CANCELLED_STATUS;
}

function cachedFields(evaluation) {
    return {
        habit_current_streak: evaluation.currentStreak,
        habit_best_streak: evaluation.bestStreak,
        habit_total_completions: evaluation.totalCompletions,
        habit_last_completion_at: evaluation.lastCompletionAt,
        habit_strength: evaluation.strength,
    };
}

function sameValue(a, b) {
    if (a instanceof Date || b instanceof Date) {
        const ta = a ? new Date(a).getTime() : null;
        const tb = b ? new Date(b).getTime() : null;
        return ta === tb;
    }
    return a === b;
}

class HabitService {
    async getUserContext(userId) {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'timezone', 'first_day_of_week'],
        });
        return {
            timezone: getSafeTimezone(user?.timezone),
            firstDayOfWeek: Number.isInteger(user?.first_day_of_week)
                ? user.first_day_of_week
                : 1,
        };
    }

    async findEntries(taskIds) {
        return RecurringCompletion.findAll({
            where: { task_id: { [Op.in]: taskIds } },
            order: [['completed_at', 'ASC']],
        });
    }

    // Recomputes the cached counters, saves them when they changed and
    // returns the evaluation (streaks, strength, current period progress).
    async refresh(task, ctx, entries = null) {
        const rows = entries || (await this.findEntries([task.id]));
        const evaluation = engine.evaluate(task, rows, ctx);
        const fields = cachedFields(evaluation);
        const changed = Object.keys(fields).filter(
            (key) => !sameValue(task[key], fields[key])
        );
        if (changed.length > 0) {
            await task.update(fields);
        }
        return evaluation;
    }

    async refreshMany(tasks, ctx) {
        if (tasks.length === 0) return new Map();
        const rows = await this.findEntries(tasks.map((t) => t.id));
        const byTask = new Map(tasks.map((t) => [t.id, []]));
        for (const row of rows) byTask.get(row.task_id)?.push(row);

        const results = new Map();
        for (const task of tasks) {
            results.set(
                task.id,
                await this.refresh(task, ctx, byTask.get(task.id))
            );
        }
        return results;
    }

    dayBounds(date, ctx) {
        const key = engine.toDayKey(date, ctx.timezone);
        const start = moment.tz(key, ctx.timezone).startOf('day');
        return {
            key,
            start: start.toDate(),
            end: start.clone().endOf('day').toDate(),
        };
    }

    async entriesOnDay(task, date, ctx) {
        const { start, end } = this.dayBounds(date, ctx);
        return RecurringCompletion.findAll({
            where: {
                task_id: task.id,
                completed_at: { [Op.between]: [start, end] },
            },
        });
    }

    parseValue(value) {
        if (value === undefined || value === null || value === '') return null;
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) {
            throw new ValidationError('Value must be a positive number');
        }
        return number;
    }

    parseNote(note) {
        if (note === undefined || note === null) return null;
        const text = String(note).trim();
        return text ? text.slice(0, 2000) : null;
    }

    async logCompletion(task, ctx, options = {}) {
        if (!task.habit_mode) {
            throw new Error('Task is not a habit');
        }
        const completedAt = options.completedAt
            ? new Date(options.completedAt)
            : new Date();
        if (Number.isNaN(completedAt.getTime())) {
            throw new ValidationError('Invalid completion date');
        }

        const cfg = engine.normalizeConfig(task, ctx);
        const value = cfg.measurable ? this.parseValue(options.value) : null;
        if (cfg.measurable && value === null) {
            throw new ValidationError(
                'This habit is measured, so a check-in needs a value'
            );
        }

        const sameDay = await this.entriesOnDay(task, completedAt, ctx);
        const checkIns = sameDay.filter((e) => !e.skipped);

        if (!engine.allowsMultiplePerDay(cfg) && checkIns.length > 0) {
            const evaluation = await this.refresh(task, ctx);
            return { completion: checkIns[0], task, evaluation };
        }
        if (
            !cfg.measurable &&
            cfg.period === 'daily' &&
            checkIns.length >= cfg.goal
        ) {
            const evaluation = await this.refresh(task, ctx);
            return { completion: checkIns[0], task, evaluation };
        }

        // A check-in on a skipped day replaces the skip.
        for (const skip of sameDay.filter((e) => e.skipped)) {
            await skip.destroy();
        }

        const completion = await RecurringCompletion.create({
            task_id: task.id,
            completed_at: completedAt,
            original_due_date: completedAt,
            skipped: false,
            value,
            note: this.parseNote(options.note),
        });

        // A habit is never done: it stays open so it keeps showing in task
        // lists, which hide it only on days it does not ask for a check-in.
        if (cfg.polarity === 'build') {
            await task.update({ completed_at: completedAt });
        }

        const evaluation = await this.refresh(task, ctx);
        return { completion, task, evaluation };
    }

    // A skipped day keeps the streak alive without counting as done.
    async skipDay(task, ctx, options = {}) {
        const cfg = engine.normalizeConfig(task, ctx);
        if (cfg.polarity === 'quit') {
            throw new ValidationError('Quit habits cannot skip a day');
        }
        const date = options.date ? new Date(options.date) : new Date();
        if (Number.isNaN(date.getTime())) {
            throw new ValidationError('Invalid date');
        }

        const sameDay = await this.entriesOnDay(task, date, ctx);
        let completion = sameDay.find((e) => e.skipped);
        if (!completion) {
            const { start } = this.dayBounds(date, ctx);
            const noon = new Date(start.getTime() + 12 * 60 * 60 * 1000);
            completion = await RecurringCompletion.create({
                task_id: task.id,
                completed_at: noon,
                original_due_date: noon,
                skipped: true,
                note: this.parseNote(options.note),
            });
        }
        const evaluation = await this.refresh(task, ctx);
        return { completion, task, evaluation };
    }

    async updateEntry(completion, data) {
        const updates = {};
        if (data.note !== undefined) updates.note = this.parseNote(data.note);
        if (data.value !== undefined && !completion.skipped) {
            updates.value = this.parseValue(data.value);
        }
        if (Object.keys(updates).length > 0) {
            await completion.update(updates);
        }
        return completion;
    }

    // The days, among `days` days from today, on which each open habit in
    // `tasks` asks for a check-in, as a map of task id to day keys. Tasks
    // that are not habits are left out.
    async dueDays(tasks, ctx, days = 1) {
        const habits = tasks.filter((t) => t.habit_mode && !isInactive(t));
        const result = new Map();
        if (habits.length === 0) return result;

        const rows = await this.findEntries(habits.map((t) => t.id));
        const byTask = new Map(habits.map((t) => [t.id, []]));
        for (const row of rows) byTask.get(row.task_id)?.push(row);

        const todayKey = engine.toDayKey(ctx.now || new Date(), ctx.timezone);
        for (const habit of habits) {
            const entries = byTask.get(habit.id);
            const keys = [];
            for (let i = 0; i < days; i++) {
                const key = engine.addDays(todayKey, i);
                if (engine.isDueOn(habit, entries, key, ctx)) keys.push(key);
            }
            result.set(habit.id, keys);
        }
        return result;
    }

    // Drops the habits that do not ask for a check-in today (done for now,
    // goal met, skipped, unscheduled or quit) and keeps every other task.
    async keepHabitsDueToday(tasks, userId) {
        if (!tasks.some((t) => t.habit_mode)) return tasks;
        const ctx = await this.getUserContext(userId);
        const due = await this.dueDays(tasks, ctx, 1);
        return tasks.filter(
            (t) => !t.habit_mode || (due.get(t.id) || []).length > 0
        );
    }

    async getHabitStats(task, ctx, startDate, endDate) {
        const entries = await this.findEntries([task.id]);
        const evaluation = await this.refresh(task, ctx, entries);
        const startKey = engine.toDayKey(startDate, ctx.timezone);
        const endKey = engine.toDayKey(endDate, ctx.timezone);

        const inRange = entries.filter((e) => {
            const key = engine.toDayKey(e.completed_at, ctx.timezone);
            return key >= startKey && key <= endKey;
        });
        const checkIns = inRange.filter((e) => !e.skipped);

        const judged = evaluation.periods.filter(
            (p) =>
                p.start >= startKey &&
                p.start <= endKey &&
                (p.status === 'success' || p.status === 'fail')
        );
        const successes = judged.filter((p) => p.status === 'success').length;

        return {
            totalCompletions: checkIns.length,
            totalValue: checkIns.reduce((sum, e) => sum + (e.value || 0), 0),
            skippedDays: inRange.length - checkIns.length,
            currentStreak: evaluation.currentStreak,
            bestStreak: evaluation.bestStreak,
            strength: evaluation.strength,
            completionRate:
                judged.length > 0 ? (successes / judged.length) * 100 : null,
            progress: evaluation.progress,
            completions: checkIns.map((c) => ({
                completed_at: c.completed_at,
                id: c.id,
                value: c.value,
                note: c.note,
            })),
        };
    }
}

module.exports = new HabitService();
module.exports.isInactive = isInactive;
module.exports.ARCHIVED_STATUS = ARCHIVED_STATUS;
