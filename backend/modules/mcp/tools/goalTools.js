'use strict';

const goalsRepository = require('../../goals/repository');

function registerGoalTools(server, context, tools) {
    // 1. list_goals - List goals with optional filtering
    tools.push({
        name: 'list_goals',
        description: 'List goals with optional filtering by area or status',
        inputSchema: {
            type: 'object',
            properties: {
                area_id: {
                    type: 'number',
                    description: 'Filter by area ID',
                },
                status: {
                    type: 'string',
                    enum: ['active', 'achieved', 'paused', 'dropped', 'all'],
                    description: 'Filter by status (default: all)',
                },
            },
        },
        handler: async (params) => {
            let goals;
            if (params.area_id) {
                goals = await goalsRepository.findAllByArea(
                    context.userId,
                    params.area_id
                );
            } else {
                goals = await goalsRepository.findAllByUser(context.userId);
            }

            if (params.status && params.status !== 'all') {
                goals = goals.filter((g) => g.status === params.status);
            }

            const serialized = goals.map((g) => ({
                id: g.id,
                uid: g.uid,
                title: g.title,
                why: g.why,
                horizon: g.horizon,
                status: g.status,
                target_date: g.target_date,
                area: g.Area
                    ? { id: g.Area.id, uid: g.Area.uid, name: g.Area.name }
                    : null,
                created_at: g.created_at,
                updated_at: g.updated_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: serialized.length, goals: serialized },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_goal - Get a single goal by UID
    tools.push({
        name: 'get_goal',
        description: 'Get a specific goal by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Goal UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const goal = await goalsRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!goal) {
                throw new Error(`Goal not found: ${params.uid}`);
            }

            const serialized = {
                id: goal.id,
                uid: goal.uid,
                title: goal.title,
                why: goal.why,
                horizon: goal.horizon,
                status: goal.status,
                target_date: goal.target_date,
                area: goal.Area
                    ? {
                          id: goal.Area.id,
                          uid: goal.Area.uid,
                          name: goal.Area.name,
                      }
                    : null,
                created_at: goal.created_at,
                updated_at: goal.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ goal: serialized }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_goal - Create a new goal
    tools.push({
        name: 'create_goal',
        description: 'Create a new goal within an area',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Goal title (required)',
                },
                area_id: {
                    type: 'number',
                    description: 'Parent area ID (required)',
                },
                why: {
                    type: 'string',
                    description: 'The motivation behind the goal',
                },
                horizon: {
                    type: 'string',
                    enum: ['season', 'year'],
                    description: 'Time horizon (default: season)',
                },
                target_date: {
                    type: 'string',
                    description: 'Target date (YYYY-MM-DD)',
                },
                status: {
                    type: 'string',
                    enum: ['active', 'achieved', 'paused', 'dropped'],
                    description: 'Goal status (default: active)',
                },
            },
            required: ['title', 'area_id'],
        },
        handler: async (params) => {
            if (!params.title || params.title.trim().length === 0) {
                throw new Error('Goal title is required');
            }

            const goal = await goalsRepository.create({
                user_id: context.userId,
                area_id: params.area_id,
                title: params.title.trim(),
                why: params.why || null,
                horizon: params.horizon || 'season',
                target_date: params.target_date || null,
                status: params.status || 'active',
            });

            const reloaded = await goalsRepository.findByUid(
                context.userId,
                goal.uid
            );

            const serialized = {
                id: reloaded.id,
                uid: reloaded.uid,
                title: reloaded.title,
                why: reloaded.why,
                horizon: reloaded.horizon,
                status: reloaded.status,
                target_date: reloaded.target_date,
                area: reloaded.Area
                    ? {
                          id: reloaded.Area.id,
                          uid: reloaded.Area.uid,
                          name: reloaded.Area.name,
                      }
                    : null,
                created_at: reloaded.created_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Goal created successfully',
                                goal: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_goal - Update an existing goal
    tools.push({
        name: 'update_goal',
        description: 'Update an existing goal',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Goal UID (required)',
                },
                title: {
                    type: 'string',
                    description: 'New title',
                },
                why: {
                    type: 'string',
                    description: 'New motivation text',
                },
                horizon: {
                    type: 'string',
                    enum: ['season', 'year'],
                    description: 'New time horizon',
                },
                target_date: {
                    type: 'string',
                    description:
                        'New target date (YYYY-MM-DD) or empty string to clear',
                },
                status: {
                    type: 'string',
                    enum: ['active', 'achieved', 'paused', 'dropped'],
                    description: 'New status',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const goal = await goalsRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!goal) {
                throw new Error(`Goal not found: ${params.uid}`);
            }

            const updates = {};
            if (params.title !== undefined) updates.title = params.title;
            if (params.why !== undefined) updates.why = params.why;
            if (params.horizon !== undefined) updates.horizon = params.horizon;
            if (params.target_date !== undefined)
                updates.target_date =
                    params.target_date === '' ? null : params.target_date;
            if (params.status !== undefined) updates.status = params.status;

            await goalsRepository.update(goal, updates);

            const reloaded = await goalsRepository.findByUid(
                context.userId,
                params.uid
            );

            const serialized = {
                id: reloaded.id,
                uid: reloaded.uid,
                title: reloaded.title,
                why: reloaded.why,
                horizon: reloaded.horizon,
                status: reloaded.status,
                target_date: reloaded.target_date,
                area: reloaded.Area
                    ? {
                          id: reloaded.Area.id,
                          uid: reloaded.Area.uid,
                          name: reloaded.Area.name,
                      }
                    : null,
                updated_at: reloaded.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Goal updated successfully',
                                goal: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_goal - Delete a goal
    tools.push({
        name: 'delete_goal',
        description: 'Delete a goal (linked projects become unlinked)',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Goal UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const goal = await goalsRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!goal) {
                throw new Error(`Goal not found: ${params.uid}`);
            }

            await goalsRepository.delete(goal);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Goal deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerGoalTools };
