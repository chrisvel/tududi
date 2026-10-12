'use strict';

// Life-to-Day (T-703 to T-706): the Capability Registry, Proposals with
// apply and Undo, isolation between users, idempotency, the write rate limit
// and the user's MCP controls, through the Bearer token transport.
const request = require('supertest');
const app = require('../../app');
const {
    Goal,
    Task,
    InboxItem,
    DailyPlan,
    DailyPlanItem,
    LtdGoalMetric,
    LtdJournal,
    LtdProposal,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { createApiToken } = require('../../modules/users/apiTokenService');
const {
    define,
    jsonSchema,
    z,
} = require('../../modules/ltd-capabilities/registry');
const { CAPABILITIES } = require('../../modules/ltd-capabilities/catalog');
const guard = require('../../modules/ltd-capabilities/guard');
const calendarFeeds = require('../../modules/calendar-feeds/service');
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
const tomorrow = () =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const planRows = async (userId, date) => {
    const plan = await DailyPlan.findOne({
        where: { user_id: userId, plan_date: date },
        include: [{ model: DailyPlanItem, as: 'Items' }],
    });
    return plan
        ? plan.Items.map((i) => [i.task_id, i.start_minute, i.duration_minutes])
        : null;
};

const EXPECTED = {
    list_goals: ['ltd.read', 'R0'],
    get_goal: ['ltd.read', 'R0'],
    get_goal_progress: ['ltd.read', 'R0'],
    get_life_vision: ['ltd.read', 'R0'],
    explain_contribution: ['ltd.read', 'R0'],
    get_weekly_plan: ['ltd.read', 'R0'],
    get_calendar_events: ['ltd.read', 'R0'],
    plan_tomorrow: ['ltd.propose', 'R2'],
    create_goal: ['ltd.propose', 'R2'],
    reschedule_tasks: ['ltd.propose', 'R2'],
    capture: ['ltd.write', 'R1'],
    checkin_metric: ['ltd.write', 'R1'],
};

describe('Capability Registry', () => {
    it('defines every tool once with a zod schema, scope and risk', () => {
        expect(
            Object.fromEntries(
                CAPABILITIES.map((c) => [c.name, [c.scope, c.risk]])
            )
        ).toEqual(EXPECTED);
        for (const capability of CAPABILITIES) {
            expect(capability.input).toBeInstanceOf(z.ZodObject);
            const schema = jsonSchema(capability);
            expect(schema.type).toBe('object');
            expect(schema.additionalProperties).toBe(false);
            expect(capability.description.length).toBeGreaterThan(20);
            expect('idempotency_key' in schema.properties).toBe(
                capability.writes
            );
        }
        for (const name of ['plan_tomorrow', 'create_goal', 'reschedule_tasks'])
            expect(
                CAPABILITIES.find((c) => c.name === name).description
            ).toMatch(
                /^Creates a proposal; nothing changes until the user approves/
            );
    });

    it('refuses a hard delete, a scope that does not fit the risk, and a non-zod input', () => {
        const base = {
            description: 'A test capability',
            input: z.strictObject({}),
            handler: () => ({}),
        };
        expect(() =>
            define({
                ...base,
                name: 'delete_goal',
                scope: 'ltd.propose',
                risk: 'R2',
            })
        ).toThrow(/never hard-delete/);
        expect(() =>
            define({
                ...base,
                name: 'move_goal',
                scope: 'ltd.write',
                risk: 'R2',
            })
        ).toThrow(/needs scope ltd.propose/);
        expect(() =>
            define({
                ...base,
                name: 'odd',
                scope: 'ltd.read',
                risk: 'R0',
                input: {},
            })
        ).toThrow(/zod object/);
    });
});

describe('MCP planning tools, Proposals and controls', () => {
    let a, b, tokenA, tokenB, agentA, agentB, vision, task, metric;

    beforeEach(async () => {
        guard.resetLimits();
        planning.invalidate();
        a = await createTestUser({ email: 'mcp-a@example.com' });
        b = await createTestUser({ email: 'mcp-b@example.com' });
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
        agentB = request.agent(app);
        await agentB
            .post('/api/login')
            .send({ email: b.email, password: 'password123' });
        vision = await Goal.create({
            user_id: a.id,
            title: 'Vision A',
            horizon: 'vision',
        });
        task = await Task.create({
            user_id: a.id,
            name: 'Draft chapter',
            status: Task.STATUS.IN_PROGRESS,
            estimated_minutes: 40,
        });
        metric = await LtdGoalMetric.create({
            goal_id: vision.id,
            name: 'Pages',
            baseline: 0,
            target: 100,
            current_value: 0,
        });
    });

    it('plan_tomorrow proposes blocks, writes nothing until applied, and Undo restores the day exactly', async () => {
        const date = tomorrow();
        const before = await planRows(a.id, date);
        const out = await call(tokenA, 'plan_tomorrow', { date });
        expect(out.isError).toBe(false);
        expect(out.value.status).toBe('pending');
        expect(out.value.ops[0]).toMatchObject({
            type: 'schedule_block',
            task_uid: task.uid,
            start_minute: 540,
            duration_minutes: 45,
        });
        expect(await planRows(a.id, date)).toEqual(before);

        const applied = await agentA
            .post(`/api/proposals/${out.value.proposal_uid}/apply`)
            .send({});
        expect(applied.status).toBe(200);
        expect(applied.body.status).toBe('applied');
        expect(await planRows(a.id, date)).toEqual([[task.id, 540, 45]]);
        const entry = await LtdJournal.findOne({
            where: { op: 'plan_blocks' },
        });
        expect(entry.actor_type).toBe('mcp');
        expect(entry.proposal_id).toBe(
            (
                await LtdProposal.findOne({
                    where: { uid: out.value.proposal_uid },
                })
            ).id
        );

        const undone = await agentA
            .post(`/api/proposals/${out.value.proposal_uid}/undo`)
            .send({});
        expect(undone.body.status).toBe('reverted');
        expect(await planRows(a.id, date)).toEqual(before);
    });

    it('create_goal and reschedule_tasks are Proposals; applying a subset and Undo are exact', async () => {
        const goal = await call(tokenA, 'create_goal', {
            title: 'Run a marathon',
            horizon: 'year',
            parent_goal_uid: vision.uid,
        });
        expect(goal.value.status).toBe('pending');
        expect(await Goal.count({ where: { title: 'Run a marathon' } })).toBe(
            0
        );

        const other = await Task.create({
            user_id: a.id,
            name: 'Email Sam',
            due_date: null,
        });
        const due = (await Task.findByPk(task.id)).due_date;
        const move = await call(tokenA, 'reschedule_tasks', {
            task_uids: [task.uid, other.uid],
            strategy: 'date',
            date: '2030-01-15',
        });
        expect(move.value.ops.map((op) => op.type)).toEqual([
            'update_task',
            'update_task',
        ]);
        expect((await Task.findByPk(task.id)).due_date).toEqual(due);

        const partial = await agentA
            .post(`/api/proposals/${move.value.proposal_uid}/apply`)
            .send({ op_ids: ['op2'] });
        expect(partial.body.status).toBe('partially_applied');
        expect((await Task.findByPk(other.id)).due_date).not.toBeNull();
        expect((await Task.findByPk(task.id)).due_date).toEqual(due);
        await agentA
            .post(`/api/proposals/${move.value.proposal_uid}/undo`)
            .send({});
        expect((await Task.findByPk(other.id)).due_date).toBeNull();

        await agentA
            .post(`/api/proposals/${goal.value.proposal_uid}/apply`)
            .send({});
        const created = await Goal.findOne({
            where: { title: 'Run a marathon' },
        });
        expect(created.parent_goal_id).toBe(vision.id);
        await agentA
            .post(`/api/proposals/${goal.value.proposal_uid}/undo`)
            .send({});
        expect(await Goal.count({ where: { user_id: a.id } })).toBe(1);
    });

    it('rejects, expires and refuses to decide twice', async () => {
        const one = await call(tokenA, 'create_goal', {
            title: 'One',
            horizon: 'year',
        });
        const rejected = await agentA
            .post(`/api/proposals/${one.value.proposal_uid}/reject`)
            .send({});
        expect(rejected.body.status).toBe('rejected');
        const again = await agentA
            .post(`/api/proposals/${one.value.proposal_uid}/apply`)
            .send({});
        expect(again.status).toBe(409);

        const two = await call(tokenA, 'create_goal', {
            title: 'Two',
            horizon: 'year',
        });
        await LtdProposal.update(
            { expires_at: new Date(Date.now() - 1000) },
            { where: { uid: two.value.proposal_uid } }
        );
        const list = await agentA.get('/api/proposals?status=expired');
        expect(list.body.proposals.map((p) => p.uid)).toEqual([
            two.value.proposal_uid,
        ]);
        expect(
            (
                await agentA
                    .post(`/api/proposals/${two.value.proposal_uid}/apply`)
                    .send({})
            ).status
        ).toBe(409);
        expect(await Goal.count({ where: { title: 'Two' } })).toBe(0);
    });

    it('never forces a change that went stale after the proposal', async () => {
        const move = await call(tokenA, 'reschedule_tasks', {
            task_uids: [task.uid],
            strategy: 'tomorrow',
        });
        await Task.update(
            { due_date: new Date('2031-03-03T12:00:00Z') },
            { where: { id: task.id } }
        );
        const stale = await agentA
            .post(`/api/proposals/${move.value.proposal_uid}/apply`)
            .send({});
        expect(stale.status).toBe(409);
        expect(stale.body.error).toMatch(/due date changed/);
        expect(
            (await agentA.get(`/api/proposals/${move.value.proposal_uid}`)).body
                .status
        ).toBe('pending');
        expect((await Task.findByPk(task.id)).due_date.toISOString()).toBe(
            '2031-03-03T12:00:00.000Z'
        );

        const date = tomorrow();
        const plan = await call(tokenA, 'plan_tomorrow', { date });
        const busy = await Task.create({ user_id: a.id, name: 'Meeting prep' });
        const day = await DailyPlan.create({ user_id: a.id, plan_date: date });
        await DailyPlanItem.create({
            daily_plan_id: day.id,
            task_id: busy.id,
            position: 0,
            start_minute: 540,
            duration_minutes: 30,
        });
        const taken = await agentA
            .post(`/api/proposals/${plan.value.proposal_uid}/apply`)
            .send({});
        expect(taken.status).toBe(409);
        expect(taken.body.error).toMatch(/no longer free/);
        expect(await planRows(a.id, date)).toEqual([[busy.id, 540, 30]]);
    });

    it('keeps User A and User B apart', async () => {
        const mine = await call(tokenA, 'create_goal', {
            title: 'Mine',
            horizon: 'year',
        });
        const uid = mine.value.proposal_uid;
        expect((await agentB.get(`/api/proposals/${uid}`)).status).toBe(404);
        expect(
            (await agentB.post(`/api/proposals/${uid}/apply`).send({})).status
        ).toBe(404);
        expect(
            (
                await request(app)
                    .get('/api/proposals')
                    .set('Authorization', `Bearer ${tokenB}`)
            ).body.proposals
        ).toEqual([]);
        // A token, even the owner's, cannot decide.
        expect(
            (
                await request(app)
                    .post(`/api/proposals/${uid}/apply`)
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({})
            ).status
        ).toBe(403);

        for (const [name, args] of [
            [
                'create_goal',
                { title: 'X', horizon: 'year', parent_goal_uid: vision.uid },
            ],
            [
                'reschedule_tasks',
                { task_uids: [task.uid], strategy: 'tomorrow' },
            ],
            ['checkin_metric', { metric_uid: metric.uid, value: 5 }],
            ['get_goal_progress', { uid: vision.uid }],
        ]) {
            const out = await call(tokenB, name, args);
            expect(out.isError).toBe(true);
            expect(out.value.error.code).toBe('not_found');
        }
        expect(await LtdProposal.count({ where: { user_id: b.id } })).toBe(0);
        expect((await LtdGoalMetric.findByPk(metric.id)).current_value).toBe(0);
    });

    it('capture and checkin_metric write at once through the Journal and undo', async () => {
        const captured = await call(tokenA, 'capture', {
            text: 'Buy a new notebook',
        });
        expect(captured.isError).toBe(false);
        const item = await InboxItem.findOne({
            where: { uid: captured.value.inbox_item_uid },
        });
        expect(item.source).toBe('mcp');
        const checked = await call(tokenA, 'checkin_metric', {
            metric_uid: metric.uid,
            value: 12,
        });
        expect(checked.value.current_value).toBe(12);

        const res = await agentA.post('/api/journal/revert').send({
            uids: [checked.value.journal_uid, captured.value.journal_uid],
        });
        expect(res.status).toBe(200);
        expect(await InboxItem.count({ where: { user_id: a.id } })).toBe(0);
        expect((await LtdGoalMetric.findByPk(metric.id)).current_value).toBe(0);
    });

    it('replays a write with the same idempotency_key instead of writing again', async () => {
        const first = await call(tokenA, 'capture', {
            text: 'Once',
            idempotency_key: 'k-1',
        });
        const second = await call(tokenA, 'capture', {
            text: 'Once',
            idempotency_key: 'k-1',
        });
        expect(second.value).toEqual({
            ...first.value,
            idempotent_replay: true,
        });
        expect(await InboxItem.count({ where: { user_id: a.id } })).toBe(1);
        const plan = await call(tokenA, 'create_goal', {
            title: 'Twice?',
            horizon: 'year',
            idempotency_key: 'k-2',
        });
        await call(tokenA, 'create_goal', {
            title: 'Twice?',
            horizon: 'year',
            idempotency_key: 'k-2',
        });
        expect(plan.isError).toBe(false);
        expect(await LtdProposal.count({ where: { user_id: a.id } })).toBe(1);
    });

    it('allows 30 writes a minute per client, then writes_disabled after repeated violations', async () => {
        for (let i = 0; i < guard.MAX_WRITES; i++) {
            expect(
                (await call(tokenA, 'capture', { text: `n${i}` })).isError
            ).toBe(false);
        }
        for (let i = 0; i < guard.STRIKES; i++) {
            const limited = await call(tokenA, 'capture', { text: 'over' });
            expect(limited.value.error.code).toBe('rate_limited');
        }
        guard.resetLimits();
        const disabled = await call(tokenA, 'capture', { text: 'after' });
        expect(disabled.value.error.code).toBe('writes_disabled');
        // Reads go on; another client of the same user is not affected.
        expect((await call(tokenA, 'list_goals')).isError).toBe(false);
        const clients = await agentA.get('/api/mcp/clients');
        const key = clients.body.clients.find((c) => c.writes_disabled_at).key;
        await agentA
            .post(`/api/mcp/clients/${encodeURIComponent(key)}/enable-writes`)
            .send({});
        expect((await call(tokenA, 'capture', { text: 'back' })).isError).toBe(
            false
        );
        expect(await InboxItem.count({ where: { user_id: a.id } })).toBe(
            guard.MAX_WRITES + 1
        );
    });

    it('read-only mode stops registry and legacy writes but not reads', async () => {
        expect(
            (
                await request(app)
                    .put('/api/mcp/read-only')
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({ on: true })
            ).status
        ).toBe(403);
        await agentA.put('/api/mcp/read-only').send({ on: true });
        const out = await call(tokenA, 'capture', { text: 'no' });
        expect(out.value.error.code).toBe('read_only');
        const legacy = await call(tokenA, 'create_task', { name: 'no' });
        expect(legacy.isError).toBe(true);
        expect(String(legacy.value)).toMatch(/read_only/);
        expect((await call(tokenA, 'list_tasks')).isError).toBe(false);
        expect(await Task.count({ where: { name: 'no' } })).toBe(0);
    });

    it('kill switch ends MCP for existing tokens and keeps the REST API', async () => {
        expect(
            (
                await request(app)
                    .post('/api/mcp/kill-switch')
                    .set('Authorization', `Bearer ${tokenA}`)
            ).status
        ).toBe(403);
        await agentA.post('/api/mcp/kill-switch').send({});
        expect((await rpc(tokenA, 'tools/list', {})).status).toBe(401);
        expect(
            (
                await request(app)
                    .get('/api/tasks')
                    .set('Authorization', `Bearer ${tokenA}`)
            ).status
        ).toBe(200);
        expect((await rpc(tokenB, 'tools/list', {})).status).toBe(200);
    });

    it('sends calendar busy time without titles unless allow_titles is true', async () => {
        jest.spyOn(calendarFeeds, 'eventsForRangeOfDays').mockResolvedValue({
            events: [
                {
                    date: '2030-01-01',
                    title: 'Therapy',
                    uid: 'x',
                    all_day: false,
                    busy: true,
                    start_minute: 600,
                    end_minute: 660,
                },
            ],
            errors: [],
        });
        const hidden = await call(tokenA, 'get_calendar_events', {
            from: '2030-01-01',
            to: '2030-01-02',
        });
        expect(JSON.stringify(hidden.value)).not.toMatch(/Therapy|"uid"/);
        expect(hidden.value.events[0]).toMatchObject({
            busy: true,
            start_minute: 600,
        });
        const shown = await call(tokenA, 'get_calendar_events', {
            from: '2030-01-01',
            to: '2030-01-02',
            allow_titles: true,
        });
        expect(shown.value.events[0].title).toBe('Therapy');
    });

    it('get_weekly_plan reads seven days without writing', async () => {
        const out = await call(tokenA, 'get_weekly_plan', {
            week_start: '2030-01-07',
        });
        expect(out.value.days.map((d) => d.date)).toEqual([
            '2030-01-07',
            '2030-01-08',
            '2030-01-09',
            '2030-01-10',
            '2030-01-11',
            '2030-01-12',
            '2030-01-13',
        ]);
        expect(await DailyPlan.count()).toBe(0);
    });

    it('returns typed validation errors', async () => {
        const out = await call(tokenA, 'reschedule_tasks', {
            task_uids: [],
            strategy: 'soon',
        });
        expect(out.value.error.code).toBe('validation');
        const missing = await call(tokenA, 'reschedule_tasks', {
            task_uids: [task.uid],
            strategy: 'date',
        });
        expect(missing.value.error.code).toBe('validation');
    });
});
