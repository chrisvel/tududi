'use strict';

const habitsService = require('../../habits/service');

const PRIORITIES = { low: 0, medium: 1, high: 2 };

function reply(payload) {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
}

function checkDate(value, field) {
    if (value !== undefined && isNaN(new Date(value).getTime())) {
        throw new Error(`Invalid ${field}: ${value}`);
    }
}

const settingsProperties = {
    note: { type: 'string', description: 'Description or notes' },
    priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Priority level',
    },
    habit_polarity: {
        type: 'string',
        enum: ['build', 'quit'],
        description:
            'build = a habit to do; quit = a habit to avoid (e.g. "no sugar"), where each logged completion records a slip',
    },
    habit_target_count: {
        type: 'number',
        description: 'Check-ins needed per period (build habits)',
    },
    habit_frequency_period: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly', 'interval'],
        description:
            'Period for the target; interval means every habit_interval_days days',
    },
    habit_target_value: {
        type: 'number',
        description:
            'Makes the habit measurable: total amount needed per period (e.g. 20 for 20 pages). Null for a simple count.',
    },
    habit_unit: {
        type: 'string',
        description: 'Unit for a measurable habit, e.g. "pages" or "km"',
    },
    habit_schedule_days: {
        type: 'array',
        items: { type: 'number' },
        description:
            'Daily habits only: weekdays it is due, 0=Sunday..6=Saturday. Omit or null for every day.',
    },
    habit_interval_days: {
        type: 'number',
        description: 'For the interval period: length in days (2-365)',
    },
    habit_time_of_day: {
        type: 'string',
        enum: ['morning', 'afternoon', 'evening'],
        description: 'Group the habit by time of day',
    },
    habit_color: {
        type: 'string',
        description:
            'Accent color as a hex value from the tududi palette, e.g. #1d4ed8',
    },
    habit_reminder_time: {
        type: 'string',
        description: 'Daily reminder time HH:MM in the user timezone',
    },
};

function settingsFrom(params) {
    const data = { ...params };
    delete data.uid;
    delete data.archived;
    if (params.priority) data.priority = PRIORITIES[params.priority];
    return data;
}

function registerHabitTools(server, context, tools) {
    tools.push({
        name: 'list_habits',
        description:
            'List habits with streaks, strength (0-100) and progress for the current period',
        inputSchema: {
            type: 'object',
            properties: {
                archived: {
                    type: 'boolean',
                    description: 'List archived habits instead',
                },
            },
        },
        handler: async (params = {}) => {
            const { habits } = await habitsService.getAll(context.userId, {
                archived: params.archived === true,
            });
            return reply({ count: habits.length, habits });
        },
    });

    tools.push({
        name: 'get_habit',
        description: 'Get a specific habit by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            return reply(
                await habitsService.getOne(context.userId, params.uid)
            );
        },
    });

    tools.push({
        name: 'create_habit',
        description:
            'Create a habit to build (e.g. "read 20 pages", "meditate 3x a week") or to quit (e.g. "no sugar")',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Habit name' },
                ...settingsProperties,
            },
            required: ['name'],
        },
        handler: async (params) => {
            const { habit } = await habitsService.create(
                context.userId,
                settingsFrom(params)
            );
            return reply({ message: 'Habit created successfully', habit });
        },
    });

    tools.push({
        name: 'update_habit',
        description: 'Update a habit, or archive / unarchive it',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
                name: { type: 'string', description: 'New habit name' },
                archived: {
                    type: 'boolean',
                    description:
                        'true archives the habit (keeps history), false restores it',
                },
                ...settingsProperties,
            },
            required: ['uid'],
        },
        handler: async (params) => {
            let result = await habitsService.update(
                context.userId,
                params.uid,
                settingsFrom(params)
            );
            if (typeof params.archived === 'boolean') {
                result = await habitsService.setArchived(
                    context.userId,
                    params.uid,
                    params.archived
                );
            }
            return reply({
                message: 'Habit updated successfully',
                habit: result.habit,
            });
        },
    });

    tools.push({
        name: 'delete_habit',
        description: 'Permanently delete a habit and its history',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            await habitsService.delete(context.userId, params.uid);
            return reply({ message: 'Habit deleted successfully' });
        },
    });

    tools.push({
        name: 'log_habit_completion',
        description:
            'Check in a habit (for a quit habit this records a slip), or skip a day so the streak is kept',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
                completed_at: {
                    type: 'string',
                    description:
                        'Completion timestamp (ISO 8601). Defaults to now.',
                },
                value: {
                    type: 'number',
                    description: 'Amount, required for measurable habits',
                },
                note: { type: 'string', description: 'Optional note' },
                skip: {
                    type: 'boolean',
                    description:
                        'Skip this day instead (rest day, illness). Build habits only.',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            checkDate(params.completed_at, 'completed_at');
            const result = params.skip
                ? await habitsService.skipDay(context.userId, params.uid, {
                      date: params.completed_at,
                      note: params.note,
                  })
                : await habitsService.logCompletion(
                      context.userId,
                      params.uid,
                      params
                  );
            return reply({
                message: params.skip
                    ? 'Day skipped'
                    : 'Completion logged successfully',
                current_streak: result.task.habit_current_streak,
                best_streak: result.task.habit_best_streak,
                total_completions: result.task.habit_total_completions,
                strength: result.task.habit_strength,
                progress: result.task.habit_progress,
            });
        },
    });

    tools.push({
        name: 'get_habit_completions',
        description:
            'Get check-ins (with value and note) and skipped days for a habit within a date range',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
                start_date: {
                    type: 'string',
                    description:
                        'Start date (ISO 8601). Defaults to 30 days ago.',
                },
                end_date: {
                    type: 'string',
                    description: 'End date (ISO 8601). Defaults to now.',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            checkDate(params.start_date, 'start_date');
            checkDate(params.end_date, 'end_date');
            const { completions } = await habitsService.getCompletions(
                context.userId,
                params.uid,
                params.start_date,
                params.end_date
            );
            return reply({ count: completions.length, completions });
        },
    });

    tools.push({
        name: 'delete_habit_completion',
        description: 'Delete a habit check-in or skipped day',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
                completion_id: {
                    type: 'number',
                    description: 'Completion ID to delete',
                },
            },
            required: ['uid', 'completion_id'],
        },
        handler: async (params) => {
            await habitsService.deleteCompletion(
                context.userId,
                params.uid,
                params.completion_id
            );
            return reply({ message: 'Completion deleted successfully' });
        },
    });

    tools.push({
        name: 'get_habit_stats',
        description:
            'Get habit statistics: streaks, strength, completion rate over judged periods, totals',
        inputSchema: {
            type: 'object',
            properties: {
                uid: { type: 'string', description: 'Habit UID' },
                start_date: {
                    type: 'string',
                    description: 'Start date (ISO 8601)',
                },
                end_date: {
                    type: 'string',
                    description: 'End date (ISO 8601)',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            checkDate(params.start_date, 'start_date');
            checkDate(params.end_date, 'end_date');
            return reply(
                await habitsService.getStats(
                    context.userId,
                    params.uid,
                    params.start_date,
                    params.end_date
                )
            );
        },
    });
}

module.exports = { registerHabitTools };
