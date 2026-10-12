'use strict';
const request = require('supertest');
const app = require('../../app');
const { Goal, LtdMilestone, LtdJournal } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Life-to-Day (T-601): Life timeline milestones API.
describe('Phase 6 milestones', () => {
    let userA, userB, agentA, agentB;
    const login = async (user) => {
        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        return agent;
    };
    beforeEach(async () => {
        userA = await createTestUser({ email: 'life-a@example.com' });
        userB = await createTestUser({ email: 'life-b@example.com' });
        agentA = await login(userA);
        agentB = await login(userB);
    });

    it('creates a life event with an ISO date and lists it in range', async () => {
        const res = await agentA
            .post('/api/milestones')
            .send({ title: ' Moved to Tehran ', date: '2019-09-23' })
            .expect(201);
        expect(res.body.milestone).toMatchObject({
            title: 'Moved to Tehran',
            date: '2019-09-23',
            date_precision: 'day',
            kind: 'life_event',
            goal_uid: null,
        });
        const inRange = await agentA
            .get('/api/milestones?from=2019-01-01&to=2019-12-31')
            .expect(200);
        expect(inRange.body.milestones.map((m) => m.title)).toEqual([
            'Moved to Tehran',
        ]);
        const outOfRange = await agentA
            .get('/api/milestones?from=2020-01-01')
            .expect(200);
        expect(outOfRange.body.milestones).toEqual([]);
        expect(
            await LtdJournal.count({ where: { op: 'milestone_create' } })
        ).toBe(1);
    });

    it('keeps the picked day for month and year precision (display-only)', async () => {
        const month = await agentA
            .post('/api/milestones')
            .send({ title: 'M', date: '2021-10-24', date_precision: 'month' })
            .expect(201);
        expect(month.body.milestone).toMatchObject({
            date: '2021-10-24',
            date_precision: 'month',
        });
        const year = await agentA
            .patch(`/api/milestones/${month.body.milestone.uid}`)
            .send({ date_precision: 'year' })
            .expect(200);
        expect(year.body.milestone).toMatchObject({
            date: '2021-10-24',
            date_precision: 'year',
        });
    });

    it('rejects Jalali or impossible dates and bad fields', async () => {
        for (const body of [
            { title: 'Jalali', date: '1403/07/01' },
            { title: 'Jalali ISO-looking', date: '1403-07-31' },
            { title: 'No day', date: '2026-02-30' },
            { title: '', date: '2026-01-01' },
            { title: 'x', date: '2026-01-01', date_precision: 'week' },
            { title: 'x', date: '2026-01-01', kind: 'chapter' },
        ])
            await agentA.post('/api/milestones').send(body).expect(400);
        await agentA.get('/api/milestones?from=2026-13-01').expect(400);
        await agentA
            .get('/api/milestones?from=2026-02-01&to=2026-01-01')
            .expect(400);
        expect(await LtdMilestone.count()).toBe(0);
    });

    it('links the user’s own goal and defaults kind to goal_milestone', async () => {
        const goal = await Goal.create({
            title: 'Run a marathon',
            user_id: userA.id,
            horizon: 'year',
        });
        const res = await agentA
            .post('/api/milestones')
            .send({
                title: 'First half marathon',
                date: '2026-04-12',
                goal_uid: goal.uid,
            })
            .expect(201);
        expect(res.body.milestone).toMatchObject({
            kind: 'goal_milestone',
            goal_uid: goal.uid,
        });
        const listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones[0].goal_uid).toBe(goal.uid);
        const unlinked = await agentA
            .patch(`/api/milestones/${res.body.milestone.uid}`)
            .send({ goal_uid: null })
            .expect(200);
        expect(unlinked.body.milestone.goal_uid).toBeNull();
    });

    it('returns 404 for another user’s goal instead of saving unlinked', async () => {
        const foreign = await Goal.create({
            title: 'B goal',
            user_id: userB.id,
            horizon: 'year',
        });
        await agentA
            .post('/api/milestones')
            .send({
                title: 'Sneaky',
                date: '2026-01-01',
                goal_uid: foreign.uid,
            })
            .expect(404);
        expect(await LtdMilestone.count()).toBe(0);
        const own = await agentA
            .post('/api/milestones')
            .send({ title: 'Mine', date: '2026-01-01' })
            .expect(201);
        await agentA
            .patch(`/api/milestones/${own.body.milestone.uid}`)
            .send({ goal_uid: foreign.uid })
            .expect(404);
        const after = await LtdMilestone.findOne({
            where: { uid: own.body.milestone.uid },
        });
        expect(after.goal_id).toBeNull();
    });

    it('user A never sees, edits or deletes user B’s milestones', async () => {
        const b = await agentB
            .post('/api/milestones')
            .send({ title: 'B private', date: '2020-02-02' })
            .expect(201);
        const listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones).toEqual([]);
        await agentA
            .patch(`/api/milestones/${b.body.milestone.uid}`)
            .send({ title: 'Hijacked' })
            .expect(404);
        await agentA
            .delete(`/api/milestones/${b.body.milestone.uid}`)
            .expect(404);
        const still = await agentB.get('/api/milestones').expect(200);
        expect(still.body.milestones.map((m) => m.title)).toEqual([
            'B private',
        ]);
    });

    it('deletes for a human and Undo restores the row through the Journal', async () => {
        const goal = await Goal.create({
            title: 'G',
            user_id: userA.id,
            horizon: 'year',
        });
        const made = await agentA
            .post('/api/milestones')
            .send({ title: 'Keep', date: '2024-03-03', goal_uid: goal.uid })
            .expect(201);
        const del = await agentA
            .delete(`/api/milestones/${made.body.milestone.uid}`)
            .expect(200);
        expect(await LtdMilestone.count()).toBe(0);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [del.body.journal_uid] })
            .expect(200);
        const listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones).toEqual([
            expect.objectContaining({
                uid: made.body.milestone.uid,
                title: 'Keep',
                goal_uid: goal.uid,
            }),
        ]);
    });

    it('undoes create and update, refusing an update undo after a newer edit', async () => {
        const journalUid = async (op) =>
            (
                await LtdJournal.findOne({
                    where: { op },
                    order: [['id', 'DESC']],
                })
            ).uid;
        const made = await agentA
            .post('/api/milestones')
            .send({ title: 'Draft', date: '2024-05-05' })
            .expect(201);
        const uid = made.body.milestone.uid;
        await agentA
            .patch(`/api/milestones/${uid}`)
            .send({ title: 'Final' })
            .expect(200);
        const updateEntry = await journalUid('milestone_update');
        await agentA
            .patch(`/api/milestones/${uid}`)
            .send({ title: 'Newer' })
            .expect(200);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [updateEntry] })
            .expect(409);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [await journalUid('milestone_update')] })
            .expect(200);
        let listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones[0].title).toBe('Final');
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [updateEntry] })
            .expect(200);
        listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones[0].title).toBe('Draft');
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [await journalUid('milestone_create')] })
            .expect(200);
        expect(await LtdMilestone.count()).toBe(0);
        // An entry that was already undone cannot be undone again.
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [updateEntry] })
            .expect(409);
    });

    it('restores a deleted milestone unlinked when its goal is gone', async () => {
        const goal = await Goal.create({
            title: 'Gone',
            user_id: userA.id,
            horizon: 'year',
        });
        const made = await agentA
            .post('/api/milestones')
            .send({ title: 'Orphan', date: '2023-03-03', goal_uid: goal.uid })
            .expect(201);
        const del = await agentA
            .delete(`/api/milestones/${made.body.milestone.uid}`)
            .expect(200);
        await goal.destroy();
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [del.body.journal_uid] })
            .expect(200);
        const listed = await agentA.get('/api/milestones').expect(200);
        expect(listed.body.milestones).toEqual([
            expect.objectContaining({ title: 'Orphan', goal_uid: null }),
        ]);
    });

    it('refuses deletion by an API token (non-human actor)', async () => {
        const made = await agentA
            .post('/api/milestones')
            .send({ title: 'Stay', date: '2024-03-03' })
            .expect(201);
        const service = require('../../modules/ltd-milestones/service');
        await expect(
            service.remove(userA.id, made.body.milestone.uid, {
                actor_type: 'mcp',
            })
        ).rejects.toThrow(/human/);
        expect(await LtdMilestone.count()).toBe(1);
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/milestones').expect(401);
        expect(res.body.milestones).toBeUndefined();
    });
});
