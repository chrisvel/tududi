'use strict';
const request = require('supertest');
const app = require('../../app');
const {
    Goal,
    Project,
    Task,
    LtdGoalMetric,
    DailyPlan,
    DailyPlanItem,
} = require('../../models');
const { createTestUser, authenticateUser } = require('../helpers/testUtils');
const planning = require('../../modules/ltd-progress/service');
const repository = require('../../modules/ltd-progress/repository');
const offsetDate = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe('Planning progress HTTP ownership and freshness', () => {
    let user, otherUser, agent, root, season, foreign, task, metric;
    beforeEach(async () => {
        planning.invalidate();
        user = await createTestUser({
            email: 'progress-owner@example.com',
            timezone: 'UTC',
        });
        otherUser = await createTestUser({
            email: 'progress-other@example.com',
            timezone: 'UTC',
        });
        agent = request.agent(app);
        await authenticateUser(agent, user);
        root = await Goal.create({
            user_id: user.id,
            title: 'Year',
            horizon: 'year',
            period_start: offsetDate(-15),
            period_end: offsetDate(15),
        });
        season = await Goal.create({
            user_id: user.id,
            title: 'Season',
            horizon: 'season',
            parent_goal_id: root.id,
            period_start: offsetDate(-15),
            period_end: offsetDate(15),
        });
        foreign = await Goal.create({
            user_id: otherUser.id,
            title: 'Private year',
            horizon: 'year',
        });
        metric = await LtdGoalMetric.create({
            goal_id: season.id,
            name: 'Outcome',
            baseline: 0,
            target: 100,
            current_value: 40,
        });
        task = await Task.create({
            user_id: user.id,
            name: 'Action',
            goal_id: season.id,
            status: 0,
            estimated_minutes: 30,
            due_date: new Date(),
        });
    });
    const get = async (goal) =>
        (await agent.get(`/api/goals/${goal.uid}/progress`).expect(200)).body;

    it.each([
        '/api/goals/tree',
        '/api/goals/no-goal/progress',
        '/api/tasks/no-task/why-chain',
    ])('%s requires authentication', async (path) => {
        expect((await request(app).get(path)).status).toBe(401);
    });

    it('reads only the authenticated user hierarchy and denies foreign progress and contribution', async () => {
        const value = (await agent.get('/api/goals/tree').expect(200)).body;
        expect(value.goals.map((g) => g.uid)).toEqual([root.uid]);
        expect(value.goals[0].children.map((g) => g.uid)).toEqual([season.uid]);
        expect(JSON.stringify(value)).not.toContain(foreign.uid);
        await agent.get(`/api/goals/${foreign.uid}/progress`).expect(404);
        const foreignTask = await Task.create({
            user_id: otherUser.id,
            name: 'Private action',
            goal_id: foreign.id,
        });
        await agent.get(`/api/tasks/${foreignTask.uid}/why-chain`).expect(404);
    });

    it('all actions can be complete while O is .4 and status remains active', async () => {
        expect(await get(season)).toMatchObject({
            A: 0,
            O: 0.4,
            health: 'stalled',
        });
        await task.update({ status: 2, completed_at: new Date() });
        expect(await get(season)).toMatchObject({
            A: 1,
            O: 0.4,
            health: 'on_track',
        });
        await season.reload();
        expect(season.status).toBe('active');
        expect(season.achieved_at).toBeNull();
    });

    it('a recent completion suppresses stalled and low O needs attention', async () => {
        await task.update({ status: 2, completed_at: new Date() });
        await metric.update({ current_value: 0 });
        planning.invalidate(user.id);
        expect(await get(season)).toMatchObject({
            A: 1,
            O: 0,
            health: 'needs_love',
        });
        await task.update({
            completed_at: new Date(Date.now() - 8 * 86400000),
        });
        expect(await get(season)).toMatchObject({ health: 'stalled' });
    });

    it('an empty goal reports null A and O rather than deriving an outcome from activity', async () => {
        const empty = await Goal.create({
            user_id: user.id,
            title: 'Empty',
            horizon: 'week',
            status: 'paused',
        });
        expect(await get(empty)).toMatchObject({
            A: null,
            O: null,
            health: null,
        });
        const unlinked = await Task.create({
            user_id: user.id,
            name: 'Unlinked',
        });
        expect(
            (
                await agent
                    .get(`/api/tasks/${unlinked.uid}/why-chain`)
                    .expect(200)
            ).body
        ).toEqual({ whyChain: [] });
    });

    it('check-in invalidates cached projections and Undo restores the previous O', async () => {
        expect((await get(season)).O).toBe(0.4);
        const checked = await agent
            .post(`/api/metrics/${metric.uid}/checkins`)
            .send({ value: 50 })
            .expect(201);
        expect((await get(season)).O).toBe(0.5);
        await agent
            .post(`/api/journal/${checked.body.journal_uid}/revert`)
            .expect(200);
        expect((await get(season)).O).toBe(0.4);
    });

    it('reparent invalidates cached tree, whyChain and ancestor progress', async () => {
        const second = await Goal.create({
            user_id: user.id,
            title: 'Other year',
            horizon: 'year',
        });
        expect((await get(root)).O).toBe(0.4);
        await agent.get('/api/goals/tree').expect(200);
        await agent
            .patch(`/api/goals/${season.uid}`)
            .send({ parent_goal_id: second.id })
            .expect(200);
        const value = (await agent.get('/api/goals/tree').expect(200)).body;
        expect(value.goals.find((g) => g.uid === root.uid).children).toEqual(
            []
        );
        expect(
            value.goals.find((g) => g.uid === second.uid).children[0].uid
        ).toBe(season.uid);
        expect((await get(root)).O).toBeNull();
        expect((await get(second)).O).toBe(0.4);
        const chain = (
            await agent.get(`/api/tasks/${task.uid}/why-chain`).expect(200)
        ).body.whyChain;
        expect(chain.map((g) => g.uid)).toEqual([season.uid, second.uid]);
    });

    it('scheduled tasks count inside the period without a due date and shared links count once', async () => {
        const project = await Project.create({
            user_id: user.id,
            name: 'Shared link',
            goal_id: season.id,
        });
        await task.update({
            project_id: project.id,
            due_date: null,
            status: 2,
            completed_at: new Date(),
        });
        const plan = await DailyPlan.create({
            user_id: user.id,
            plan_date: offsetDate(0),
        });
        await DailyPlanItem.create({
            daily_plan_id: plan.id,
            task_id: task.id,
        });
        expect(await get(root)).toMatchObject({ A: 1, O: 0.4 });
        await Task.create({
            user_id: user.id,
            name: 'Second action',
            goal_id: season.id,
            due_date: new Date(),
            estimated_minutes: 30,
        });
        expect((await get(root)).A).toBe(0.5);
    });

    it('short cache reuses snapshots and caller invalidation refreshes them', async () => {
        const fetch = jest.spyOn(repository, 'snapshot');
        await planning.progress(user.id, root.uid);
        await planning.tree(user.id, { status: 'active' });
        await planning.lifeVision(user.id);
        expect(fetch).toHaveBeenCalledTimes(1);
        planning.invalidate(user.id);
        await planning.tree(user.id, { area_id: -1 });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('a snapshot invalidated while loading is not cached for later readers', async () => {
        const original = repository.snapshot;
        const load = jest
            .spyOn(repository, 'snapshot')
            .mockImplementationOnce(async (userId) => {
                const snapshot = await original(userId);
                planning.invalidate(userId);
                return snapshot;
            });
        await planning.tree(user.id);
        await planning.tree(user.id);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('the progress router independently rejects a missing identity', async () => {
        const router = require('../../modules/ltd-progress/routes');
        const handler = router.stack.find(
            (layer) => layer.route?.path === '/goals/tree'
        ).route.stack[0].handle;
        const next = jest.fn();
        const json = jest.fn();
        await handler({ session: {} }, { json }, next);
        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 401 })
        );
        expect(json).not.toHaveBeenCalled();
    });

    it('empty-user snapshots and expired cache remain safe', async () => {
        const emptyUser = await createTestUser({
            email: 'progress-empty@example.com',
        });
        expect(await planning.tree(emptyUser.id)).toEqual([]);
        expect(await planning.lifeVision(emptyUser.id)).toEqual([]);
        const time = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);
        expect(await planning.tree(emptyUser.id)).toEqual([]);
        time.mockRestore();
    });
});
