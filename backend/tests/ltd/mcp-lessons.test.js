'use strict';

// Life-to-Day (T-1104): lesson tools over MCP. Reads answer at once and only
// for the token's user; creating or editing a lesson is a Proposal that
// writes nothing until the user applies it; deleting is not a tool.
const request = require('supertest');
const app = require('../../app');
const {
    Goal,
    Task,
    LtdLesson,
    LtdJournal,
    LtdProposal,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { createApiToken } = require('../../modules/users/apiTokenService');
const { jsonSchema } = require('../../modules/ltd-capabilities/registry');
const { CAPABILITIES } = require('../../modules/ltd-capabilities/catalog');
const guard = require('../../modules/ltd-capabilities/guard');
const planning = require('../../modules/ltd-progress/service');

const rpc = (token, method, params) =>
    request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${token}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method, params });
const result = (res) =>
    JSON.parse(
        res.text
            .split('\n')
            .find((line) => line.startsWith('data: '))
            .slice(6)
    ).result;
const call = async (token, name, args = {}) => {
    const out = result(
        await rpc(token, 'tools/call', { name, arguments: args })
    );
    let value;
    try {
        value = JSON.parse(out.content[0].text);
    } catch {
        value = out.content[0].text;
    }
    return { isError: !!out.isError, value };
};
const tool = (name) => CAPABILITIES.find((c) => c.name === name);

describe('Phase 11 lesson tool schemas', () => {
    it('publishes closed schemas; reads take no idempotency key, writes do', () => {
        expect(
            Object.keys(jsonSchema(tool('get_task_effect')).properties)
        ).toEqual(['task_uid']);
        expect(
            Object.keys(jsonSchema(tool('list_lessons')).properties).sort()
        ).toEqual(['goal_uid', 'status']);
        expect(Object.keys(jsonSchema(tool('get_lesson')).properties)).toEqual([
            'uid',
        ]);
        const create = jsonSchema(tool('create_lesson'));
        expect(create.required).toEqual(['title']);
        expect(Object.keys(create.properties).sort()).toEqual([
            'expected',
            'happened',
            'idempotency_key',
            'if_text',
            'learned_on',
            'links',
            'reason',
            'review_on',
            'then_text',
            'title',
        ]);
        expect(create.properties.links.items.properties.type.enum).toEqual([
            'goal',
            'project',
            'area',
            'tag',
        ]);
        const update = jsonSchema(tool('update_lesson'));
        expect(update.required).toEqual(['uid']);
        expect(update.properties.status.enum).toEqual([
            'active',
            'parked',
            'retired',
        ]);
        for (const name of ['create_lesson', 'update_lesson', 'list_lessons'])
            expect(jsonSchema(tool(name)).additionalProperties).toBe(false);
        expect(
            CAPABILITIES.some(
                (c) => /lesson/.test(c.name) && /delete|remove/.test(c.name)
            )
        ).toBe(false);
    });
});

describe('Phase 11 lesson tools over MCP', () => {
    let a, b, tokenA, tokenB, agentA, goalA, goalB, taskA, taskB;
    beforeEach(async () => {
        guard.resetLimits();
        planning.invalidate();
        a = await createTestUser({ email: 'lesson-mcp-a@example.com' });
        b = await createTestUser({ email: 'lesson-mcp-b@example.com' });
        tokenA = (
            await createApiToken({ userId: a.id, name: 'a', expiresAt: null })
        ).rawToken;
        tokenB = (
            await createApiToken({ userId: b.id, name: 'b', expiresAt: null })
        ).rawToken;
        agentA = request.agent(app);
        await agentA
            .post('/api/login')
            .send({ email: a.email, password: 'password123' });
        goalA = await Goal.create({
            user_id: a.id,
            title: 'Five years A',
            horizon: 'five_year',
        });
        goalB = await Goal.create({
            user_id: b.id,
            title: 'Goal B',
            horizon: 'year',
        });
        taskA = await Task.create({
            user_id: a.id,
            name: 'Task A',
            goal_id: goalA.id,
        });
        taskB = await Task.create({ user_id: b.id, name: 'Task B' });
    });

    it('lists the tools; no lesson delete tool exists', async () => {
        const res = await rpc(tokenA, 'tools/list', {});
        const names = result(res).tools.map((t) => t.name);
        for (const name of [
            'get_task_effect',
            'list_lessons',
            'get_lesson',
            'create_lesson',
            'update_lesson',
        ])
            expect(names).toContain(name);
        expect(names.filter((n) => /lesson/.test(n))).not.toContain(
            'delete_lesson'
        );
        const out = await call(tokenA, 'delete_lesson', { uid: 'x' });
        expect(out.isError).toBe(true);
        expect(String(out.value)).toMatch(/unavailable/i);
    });

    it('create_lesson writes nothing until applied; apply and Undo go through the Journal', async () => {
        const out = await call(tokenA, 'create_lesson', {
            title: 'Ask early',
            if_text: 'I am stuck for 20 minutes',
            then_text: 'I ask someone',
            links: [{ type: 'goal', uid: goalA.uid }],
            reason: 'From our chat',
        });
        expect(out.isError).toBe(false);
        expect(out.value).toMatchObject({
            status: 'pending',
            risk_tier: 'R2',
            ops: [
                expect.objectContaining({
                    type: 'create_lesson',
                    title: 'Ask early',
                    links: [
                        { type: 'goal', uid: goalA.uid, title: 'Five years A' },
                    ],
                }),
            ],
        });
        expect(await LtdLesson.count()).toBe(0);

        const applied = await agentA
            .post(`/api/proposals/${out.value.proposal_uid}/apply`)
            .send({})
            .expect(200);
        expect(applied.body.status).toBe('applied');
        const lesson = await LtdLesson.findOne({ where: { user_id: a.id } });
        expect(lesson).toMatchObject({
            title: 'Ask early',
            then_text: 'I ask someone',
        });
        const entry = await LtdJournal.findOne({
            where: { op: 'lesson_create' },
        });
        expect(entry.actor_type).toBe('mcp');
        expect(entry.proposal_id).not.toBeNull();

        const effect = await call(tokenA, 'get_task_effect', {
            task_uid: taskA.uid,
        });
        expect(effect.value).toMatchObject({
            kind: 'linked',
            fiveYear: { uid: goalA.uid },
            lesson: { uid: lesson.uid, if_text: 'I am stuck for 20 minutes' },
        });

        await agentA
            .post(`/api/proposals/${out.value.proposal_uid}/undo`)
            .send({})
            .expect(200);
        expect(await LtdLesson.count()).toBe(0);
    });

    it('update_lesson is a Proposal; status can change but nothing is deleted', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({ title: 'Old title' })
            .expect(201);
        const uid = made.body.lesson.uid;
        const out = await call(tokenA, 'update_lesson', {
            uid,
            title: 'New title',
            status: 'retired',
        });
        expect(out.value.ops[0]).toMatchObject({
            type: 'update_lesson',
            lesson_uid: uid,
            lesson_title: 'Old title',
            changes: { title: 'New title', status: 'retired' },
        });
        expect((await LtdLesson.findOne({ where: { uid } })).title).toBe(
            'Old title'
        );
        await agentA
            .post(`/api/proposals/${out.value.proposal_uid}/apply`)
            .send({})
            .expect(200);
        expect(await LtdLesson.findOne({ where: { uid } })).toMatchObject({
            title: 'New title',
            status: 'retired',
        });
        const nothing = await call(tokenA, 'update_lesson', { uid });
        expect(nothing.value.proposal_uid).toBeNull();
    });

    it('keeps User A and User B apart', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({
                title: 'A only',
                links: [{ type: 'goal', uid: goalA.uid }],
            })
            .expect(201);
        const uid = made.body.lesson.uid;
        expect(
            (await call(tokenA, 'get_lesson', { uid })).value.lesson.title
        ).toBe('A only');
        for (const [name, args] of [
            ['get_lesson', { uid }],
            ['update_lesson', { uid, title: 'Hijack' }],
            ['get_task_effect', { task_uid: taskA.uid }],
            ['list_lessons', { goal_uid: goalA.uid }],
            [
                'create_lesson',
                { title: 'x', links: [{ type: 'goal', uid: goalA.uid }] },
            ],
        ]) {
            const out = await call(tokenB, name, args);
            expect(out.isError).toBe(true);
            expect(out.value.error.code).toBe('not_found');
        }
        expect((await call(tokenB, 'list_lessons')).value).toEqual({
            count: 0,
            lessons: [],
        });
        const own = await call(tokenA, 'list_lessons', {
            goal_uid: goalA.uid,
        });
        expect(own.value.lessons.map((l) => l.uid)).toEqual([uid]);
        const foreign = await call(tokenA, 'get_task_effect', {
            task_uid: taskB.uid,
        });
        expect(foreign.value.error.code).toBe('not_found');
        const linkB = await call(tokenA, 'create_lesson', {
            title: 'x',
            links: [{ type: 'goal', uid: goalB.uid }],
        });
        expect(linkB.value.error.code).toBe('not_found');
        expect(await LtdProposal.count()).toBe(0);
    });

    it('returns typed validation errors and proposes nothing', async () => {
        for (const args of [
            { title: 'x', if_text: 'tired' },
            { title: 'x', learned_on: '1403-07-21' },
            { title: 'x', learned_on: '1403/07/21' },
            { title: '' },
        ]) {
            const out = await call(tokenA, 'create_lesson', args);
            expect(out.value.error.code).toBe('validation');
        }
        expect(await LtdProposal.count()).toBe(0);
    });
});
