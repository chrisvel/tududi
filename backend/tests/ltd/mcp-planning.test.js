'use strict';

const request = require('supertest');
const app = require('../../app');
const {
    User,
    Area,
    Goal,
    Project,
    Task,
    LtdGoalMetric,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { createApiToken } = require('../../modules/users/apiTokenService');
const { registerGoalTools } = require('../../modules/mcp/tools/goalTools');
const { registerAllTools } = require('../../modules/mcp/toolRegistry');
const planning = require('../../modules/ltd-progress/service');

const decode = (res) => {
    const rpc = JSON.parse(
        res.text
            .split('\n')
            .find((line) => line.startsWith('data: '))
            .slice(6)
    );
    return rpc.result;
};
const read = (res) => JSON.parse(decode(res).content[0].text);
const call = (token, name, args = {}) =>
    request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${token}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
        });

describe('Phase 4 MCP planning contract and isolation', () => {
    let a, b, token, vision, child, other, task, otherTask;
    beforeEach(async () => {
        planning.invalidate();
        a = await createTestUser({ email: 'planning-a@example.com' });
        b = await createTestUser({ email: 'planning-b@example.com' });
        token = (
            await createApiToken({
                userId: a.id,
                name: 'planning',
                expiresAt: null,
            })
        ).rawToken;
        const area = await Area.create({ user_id: a.id, name: 'Owned area' });
        const otherArea = await Area.create({
            user_id: b.id,
            name: 'Private area',
        });
        vision = await Goal.create({
            user_id: a.id,
            area_id: area.id,
            title: 'Owned vision',
            horizon: 'vision',
        });
        child = await Goal.create({
            user_id: a.id,
            area_id: area.id,
            title: 'Owned year',
            horizon: 'year',
            parent_goal_id: vision.id,
        });
        other = await Goal.create({
            user_id: b.id,
            area_id: otherArea.id,
            title: 'Secret vision',
            horizon: 'vision',
        });
        await LtdGoalMetric.create({
            goal_id: child.id,
            name: 'Owned metric',
            baseline: 0,
            target: 100,
            current_value: 50,
        });
        await LtdGoalMetric.create({
            goal_id: other.id,
            name: 'Secret metric',
            baseline: 0,
            target: 100,
            current_value: 99,
        });
        const project = await Project.create({
            user_id: a.id,
            name: 'Owned project',
            goal_id: child.id,
        });
        task = await Task.create({
            user_id: a.id,
            name: 'Owned task',
            project_id: project.id,
        });
        otherTask = await Task.create({
            user_id: b.id,
            name: 'Secret task',
            goal_id: other.id,
        });
    });

    it('publishes exact closed schemas and only read-only goal tools', () => {
        const tools = [];
        registerGoalTools({}, { userId: a.id }, tools);
        expect(tools.map((t) => t.name)).toEqual([
            'list_goals',
            'get_goal',
            'get_goal_progress',
            'get_life_vision',
            'explain_contribution',
        ]);
        for (const tool of tools)
            expect(tool.inputSchema.additionalProperties).toBe(false);
        expect(
            tools.find((t) => t.name === 'get_goal_progress').inputSchema
        ).toEqual({
            type: 'object',
            properties: {
                uid: { type: 'string', minLength: 1, description: 'Goal UID' },
            },
            required: ['uid'],
            additionalProperties: false,
        });
        expect(
            tools.find((t) => t.name === 'get_life_vision').inputSchema
        ).toEqual({
            type: 'object',
            properties: {},
            additionalProperties: false,
        });
        expect(
            tools.find((t) => t.name === 'explain_contribution').inputSchema
                .required
        ).toEqual(['task_uid']);
        expect(
            tools.find((t) => t.name === 'list_goals').inputSchema.properties
                .status.enum
        ).toEqual(['active', 'achieved', 'paused', 'dropped', 'all']);
        const registry = [];
        registerAllTools({}, { userId: a.id, user: a }, registry);
        expect(
            registry.filter((t) => /^(delete|remove)_/.test(t.name))
        ).toEqual([]);
    });

    it('returns the horizon tree with independent A and O and excludes other users and metrics', async () => {
        const value = read(await call(token, 'list_goals'));
        expect(value.count).toBe(2);
        expect(value.goals).toHaveLength(1);
        expect(value.goals[0].uid).toBe(vision.uid);
        expect(value.goals[0].children[0]).toMatchObject({
            uid: child.uid,
            progress: { A: null, O: 0.5 },
        });
        expect(JSON.stringify(value)).not.toContain('Secret');
        expect(JSON.stringify(value)).not.toContain(other.uid);
    });

    it('area filtering cannot expose another user tree', async () => {
        const value = read(
            await call(token, 'list_goals', { area_id: other.area_id })
        );
        expect(value).toEqual({ count: 0, goals: [] });
    });

    it('goal progress matches the HTTP service and denies another user goal', async () => {
        expect(
            read(await call(token, 'get_goal_progress', { uid: child.uid }))
        ).toEqual(await planning.progress(a.id, child.uid));
        expect(
            decode(await call(token, 'get_goal_progress', { uid: other.uid }))
                .isError
        ).toBe(true);
        expect(
            decode(await call(token, 'get_goal', { uid: other.uid })).isError
        ).toBe(true);
    });

    it('reads only the authenticated user vision', async () => {
        const value = read(await call(token, 'get_life_vision'));
        expect(value.visions.map((g) => g.uid)).toEqual([vision.uid]);
        expect(JSON.stringify(value)).not.toContain(other.uid);
    });

    it('explains the same project goal to root whyChain and rejects another user task', async () => {
        const value = read(
            await call(token, 'explain_contribution', { task_uid: task.uid })
        );
        expect(value.whyChain).toEqual(await planning.whyChain(a.id, task.uid));
        expect(value.whyChain.map((g) => g.uid)).toEqual([
            child.uid,
            vision.uid,
        ]);
        expect(
            decode(
                await call(token, 'explain_contribution', {
                    task_uid: otherTask.uid,
                })
            ).isError
        ).toBe(true);
    });

    it('uses a direct task goal before its project goal', async () => {
        await task.update({ goal_id: vision.id });
        const value = read(
            await call(token, 'explain_contribution', { task_uid: task.uid })
        );
        expect(value.whyChain.map((g) => g.uid)).toEqual([vision.uid]);
    });

    it.each([
        'delete_goal',
        'create_goal',
        'update_goal',
        'delete_task',
        'delete_project',
        'delete_habit',
    ])('%s cannot mutate through HTTP dispatch', async (name) => {
        expect(
            decode(await call(token, name, { uid: other.uid })).isError
        ).toBe(true);
        expect(await Goal.count({ where: { user_id: b.id } })).toBe(1);
        expect(await User.count()).toBe(2);
    });
});
