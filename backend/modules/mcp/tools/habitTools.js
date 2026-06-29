'use strict';

const habitsRepository = require('../../habits/repository');
const habitService = require('../../habits/habitService');

/**
 * Register all habit-related MCP tools
 */
function registerHabitTools(server, context, tools) {
    // 1. list_habits - List all habits
    tools.push({
        name: 'list_habits',
        description: 'List all habits for the current user',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const habits = await habitsRepository.findAllByUser(context.userId);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: habits.length, habits },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_habit - Get a single habit by UID
    tools.push({
        name: 'get_habit',
        description: 'Get a specific habit by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ habit }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_habit - Create a new habit
    tools.push({
        name: 'create_habit',
        description: 'Create a new habit',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Habit name',
                },
                note: {
                    type: 'string',
                    description: 'Description or notes',
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Priority level',
                },
                habit_target_count: {
                    type: 'number',
                    description: 'Target completions per period',
                },
                habit_frequency_period: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'monthly'],
                    description: 'Frequency period for target',
                },
                habit_streak_mode: {
                    type: 'string',
                    enum: ['calendar', 'scheduled'],
                    description: 'How streaks are calculated',
                },
                habit_flexibility_mode: {
                    type: 'string',
                    enum: ['flexible', 'strict'],
                    description: 'Whether completions are flexible day-to-day',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            const habitData = {
                name: params.name,
                note: params.note || '',
                priority: params.priority
                    ? { low: 0, medium: 1, high: 2 }[params.priority]
                    : 1,
                habit_target_count: params.habit_target_count || null,
                habit_frequency_period: params.habit_frequency_period || null,
                habit_streak_mode: params.habit_streak_mode || 'calendar',
                habit_flexibility_mode:
                    params.habit_flexibility_mode || 'flexible',
            };

            const habit = await habitsRepository.createHabit(
                context.userId,
                habitData
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Habit created successfully', habit },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_habit - Update an existing habit
    tools.push({
        name: 'update_habit',
        description: 'Update an existing habit',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
                name: {
                    type: 'string',
                    description: 'New habit name',
                },
                note: {
                    type: 'string',
                    description: 'New description',
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Priority level',
                },
                habit_target_count: {
                    type: 'number',
                    description: 'Target completions per period',
                },
                habit_frequency_period: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'monthly'],
                    description: 'Frequency period for target',
                },
                habit_streak_mode: {
                    type: 'string',
                    enum: ['calendar', 'scheduled'],
                    description: 'How streaks are calculated',
                },
                habit_flexibility_mode: {
                    type: 'string',
                    enum: ['flexible', 'strict'],
                    description: 'Whether completions are flexible',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name;
            if (params.note !== undefined) updates.note = params.note;
            if (params.priority)
                updates.priority = { low: 0, medium: 1, high: 2 }[
                    params.priority
                ];
            if (params.habit_target_count !== undefined)
                updates.habit_target_count = params.habit_target_count;
            if (params.habit_frequency_period !== undefined)
                updates.habit_frequency_period = params.habit_frequency_period;
            if (params.habit_streak_mode !== undefined)
                updates.habit_streak_mode = params.habit_streak_mode;
            if (params.habit_flexibility_mode !== undefined)
                updates.habit_flexibility_mode = params.habit_flexibility_mode;

            await habitsRepository.update(habit, updates);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Habit updated successfully', habit },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_habit - Delete a habit
    tools.push({
        name: 'delete_habit',
        description: 'Permanently delete a habit',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            await habitsRepository.destroy(habit);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Habit deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 6. log_habit_completion - Log a completion for a habit
    tools.push({
        name: 'log_habit_completion',
        description:
            'Log a completion for a habit, updating streaks and counters',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
                completed_at: {
                    type: 'string',
                    description:
                        'Completion timestamp (ISO 8601). Defaults to now.',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            let completedAt = new Date();
            if (params.completed_at) {
                completedAt = new Date(params.completed_at);
                if (isNaN(completedAt.getTime())) {
                    throw new Error(
                        `Invalid completed_at date: ${params.completed_at}`
                    );
                }
            }

            const result = await habitService.logCompletion(habit, completedAt);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Completion logged successfully',
                                current_streak:
                                    result.task.habit_current_streak,
                                best_streak: result.task.habit_best_streak,
                                total_completions:
                                    result.task.habit_total_completions,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 7. get_habit_completions - Get completions for a habit
    tools.push({
        name: 'get_habit_completions',
        description: 'Get completion history for a habit within a date range',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
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
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            const start = params.start_date
                ? new Date(params.start_date)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = params.end_date
                ? new Date(params.end_date)
                : new Date();

            if (params.start_date && isNaN(start.getTime())) {
                throw new Error(`Invalid start_date: ${params.start_date}`);
            }
            if (params.end_date && isNaN(end.getTime())) {
                throw new Error(`Invalid end_date: ${params.end_date}`);
            }

            const completions = await habitsRepository.findCompletions(
                habit.id,
                start,
                end
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: completions.length, completions },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 8. delete_habit_completion - Delete a habit completion
    tools.push({
        name: 'delete_habit_completion',
        description: 'Delete a specific habit completion',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
                completion_id: {
                    type: 'number',
                    description: 'Completion ID to delete',
                },
            },
            required: ['uid', 'completion_id'],
        },
        handler: async (params) => {
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            const completion = await habitsRepository.findCompletionById(
                params.completion_id,
                habit.id
            );

            if (!completion) {
                throw new Error(
                    `Completion not found: ${params.completion_id}`
                );
            }

            await completion.destroy();
            const updates = await habitService.recalculateStreaks(habit);
            await habitsRepository.update(habit, updates);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Completion deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 9. get_habit_stats - Get habit statistics
    tools.push({
        name: 'get_habit_stats',
        description:
            'Get habit statistics including streaks and completion rate',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Habit UID',
                },
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
            const habit = await habitsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!habit || !habit.habit_mode) {
                throw new Error(`Habit not found: ${params.uid}`);
            }

            const start = params.start_date
                ? new Date(params.start_date)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = params.end_date
                ? new Date(params.end_date)
                : new Date();

            if (params.start_date && isNaN(start.getTime())) {
                throw new Error(`Invalid start_date: ${params.start_date}`);
            }
            if (params.end_date && isNaN(end.getTime())) {
                throw new Error(`Invalid end_date: ${params.end_date}`);
            }

            const stats = await habitService.getHabitStats(habit, start, end);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(stats, null, 2),
                    },
                ],
            };
        },
    });
}

module.exports = { registerHabitTools };
