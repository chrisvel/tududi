'use strict';

// LTD-PATCH(T-407): Planning tools share owned progress reads; goal mutations await Journal/Proposal support.
const goalsRepository = require('../../goals/repository');
const areasRepository = require('../../areas/repository');
const planning = require('../../ltd-progress/service');

const response = (value) => ({
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});
const uidSchema = (key, description) => ({
    type: 'object',
    properties: { [key]: { type: 'string', minLength: 1, description } },
    required: [key],
    additionalProperties: false,
});

function registerGoalTools(server, context, tools) {
    tools.push({
        name: 'list_goals',
        description:
            'Read the goal horizon tree with separate activity (A) and outcome (O) progress',
        inputSchema: {
            type: 'object',
            properties: {
                area_id: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Filter by owned area ID',
                },
                status: {
                    type: 'string',
                    enum: ['active', 'achieved', 'paused', 'dropped', 'all'],
                    description: 'Filter by status (default: all)',
                },
            },
            additionalProperties: false,
        },
        handler: async (params = {}) => {
            const goals = await planning.tree(context.userId, params);
            const count = (nodes) =>
                nodes.reduce(
                    (total, node) => total + 1 + count(node.children || []),
                    0
                );
            return response({ count: count(goals), goals });
        },
    });
    tools.push({
        name: 'get_goal',
        description: 'Read an owned goal by UID',
        inputSchema: uidSchema('uid', 'Goal UID'),
        handler: async (params) => {
            const goal = await goalsRepository.findByUid(
                context.userId,
                params.uid
            );
            if (!goal) throw new Error('Goal not found');
            const area = goal.Area
                ? await areasRepository.findByUid(context.userId, goal.Area.uid)
                : null;
            return response({
                goal: {
                    id: goal.id,
                    uid: goal.uid,
                    title: goal.title,
                    why: goal.why,
                    horizon: goal.horizon,
                    status: goal.status,
                    target_date: goal.target_date,
                    parent_goal_id: goal.parent_goal_id,
                    period_start: goal.period_start,
                    period_end: goal.period_end,
                    achieved_at: goal.achieved_at,
                    area: area
                        ? {
                              id: area.id,
                              uid: area.uid,
                              name: area.name,
                          }
                        : null,
                    projects: (goal.Projects || []).map((p) => ({
                        id: p.id,
                        uid: p.uid,
                        name: p.name,
                        status: p.status,
                    })),
                    created_at: goal.created_at,
                    updated_at: goal.updated_at,
                },
            });
        },
    });
    tools.push({
        name: 'get_goal_progress',
        description:
            'Read computed A and O, health and expected progress for an owned goal',
        inputSchema: uidSchema('uid', 'Goal UID'),
        handler: async (params) =>
            response(await planning.progress(context.userId, params.uid)),
    });
    tools.push({
        name: 'get_life_vision',
        description:
            'Read owned vision goals with their horizon tree and progress',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () =>
            response({ visions: await planning.lifeVision(context.userId) }),
    });
    tools.push({
        name: 'explain_contribution',
        description:
            'Read the task goal or project goal why chain from that goal to its root',
        inputSchema: uidSchema('task_uid', 'Task UID'),
        handler: async (params) =>
            response({
                whyChain: await planning.whyChain(
                    context.userId,
                    params.task_uid
                ),
            }),
    });
}

module.exports = { registerGoalTools };
