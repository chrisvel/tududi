'use strict';
const request = require('supertest');
const app = require('../../app');
const {
    Goal,
    Project,
    Area,
    Tag,
    Task,
    LtdGoalMetric,
    LtdLesson,
    LtdLessonLink,
    LtdLessonCheck,
    LtdJournal,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Life-to-Day (T-1101, T-1102): life lessons and the task effect, through the
// API. Runs on SQLite and, in CI, on PostgreSQL.
const addDays = (day, days) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

describe('Phase 11 lessons', () => {
    let userA, userB, agentA, agentB, goal;
    const login = async (user) => {
        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        return agent;
    };
    const journalUid = async (op) =>
        (
            await LtdJournal.findOne({
                where: { op },
                order: [['id', 'DESC']],
            })
        ).uid;
    beforeEach(async () => {
        userA = await createTestUser({ email: 'lesson-a@example.com' });
        userB = await createTestUser({ email: 'lesson-b@example.com' });
        agentA = await login(userA);
        agentB = await login(userB);
        goal = await Goal.create({
            user_id: userA.id,
            title: 'Spanish B1',
            horizon: 'year',
        });
    });

    it('saves a lesson with only a title; review_on defaults to learned_on + 14', async () => {
        const res = await agentA
            .post('/api/lessons')
            .send({ title: ' Start small ', learned_on: '2026-10-01' })
            .expect(201);
        expect(res.body.lesson).toMatchObject({
            title: 'Start small',
            learned_on: '2026-10-01',
            review_on: '2026-10-15',
            status: 'active',
            expected: null,
            happened: null,
            if_text: null,
            then_text: null,
            links: [],
        });
        expect(res.body.warning).toBeUndefined();
        expect(await LtdJournal.count({ where: { op: 'lesson_create' } })).toBe(
            1
        );
        const empty = await agentA
            .post('/api/lessons')
            .send({
                title: 'No review',
                learned_on: '2026-10-01',
                review_on: null,
            })
            .expect(201);
        expect(empty.body.lesson.review_on).toBeNull();
    });

    it('keeps expected and happened for good and bad experiences', async () => {
        const res = await agentA
            .post('/api/lessons')
            .send({
                title: 'Mornings work',
                expected: 'I thought evenings were better',
                happened: 'I learned twice as much at 7:00',
                if_text: 'I plan study time',
                then_text: 'I put it before 9:00',
            })
            .expect(201);
        expect(res.body.lesson).toMatchObject({
            expected: 'I thought evenings were better',
            happened: 'I learned twice as much at 7:00',
            if_text: 'I plan study time',
            then_text: 'I put it before 9:00',
        });
    });

    it('rejects an if without a then (and the reverse) with 400', async () => {
        await agentA
            .post('/api/lessons')
            .send({ title: 'x', if_text: 'tired' })
            .expect(400);
        await agentA
            .post('/api/lessons')
            .send({ title: 'x', then_text: 'rest', if_text: '   ' })
            .expect(400);
        const made = await agentA
            .post('/api/lessons')
            .send({ title: 'x' })
            .expect(201);
        await agentA
            .patch(`/api/lessons/${made.body.lesson.uid}`)
            .send({ if_text: 'tired' })
            .expect(400);
        await agentA
            .patch(`/api/lessons/${made.body.lesson.uid}`)
            .send({ if_text: 'tired', then_text: 'rest' })
            .expect(200);
        await agentA
            .patch(`/api/lessons/${made.body.lesson.uid}`)
            .send({ then_text: '' })
            .expect(400);
        expect(await LtdLesson.count()).toBe(1);
    });

    it('rejects Jalali dates, years before 1600 and bad fields', async () => {
        for (const body of [
            { title: 'Jalali', learned_on: '1403/07/01' },
            { title: 'Jalali ISO-looking', learned_on: '1403-07-21' },
            { title: 'Old', learned_on: '1599-12-31' },
            { title: 'Review', review_on: '1404-01-01' },
            { title: 'No day', learned_on: '2026-02-30' },
            { title: '' },
            { title: 'x', status: 'archived' },
            { title: 'x', links: [{ type: 'note', uid: 'abc' }] },
            { title: 'x', source_type: 'note' },
            { title: 'x', source_uid: 'abc' },
        ])
            await agentA.post('/api/lessons').send(body).expect(400);
        await agentA.get('/api/lessons/due?date=1403-07-01').expect(400);
        expect(await LtdLesson.count()).toBe(0);
    });

    it('accepts a client uid once and returns the same lesson on retry', async () => {
        const uid = 'abcdefghijk2345';
        const first = await agentA
            .post('/api/lessons')
            .send({ uid, title: 'Offline' })
            .expect(201);
        expect(first.body.lesson.uid).toBe(uid);
        const again = await agentA
            .post('/api/lessons')
            .send({ uid, title: 'Offline' })
            .expect(200);
        expect(again.body.lesson.uid).toBe(uid);
        await agentB
            .post('/api/lessons')
            .send({ uid, title: 'Steal' })
            .expect(400);
        await agentA
            .post('/api/lessons')
            .send({ uid: 'NOT-A-UID', title: 'x' })
            .expect(400);
        expect(await LtdLesson.count()).toBe(1);
    });

    // The offline contract: one key and one client uid per create. The key
    // is stored after the response, so the uid is what dedupes a fast retry.
    it('a retried create with one Idempotency-Key and uid writes once', async () => {
        const send = () =>
            agentA
                .post('/api/lessons')
                .set('Idempotency-Key', 'ltd-lesson-key-1')
                .send({ uid: 'qrstuvwxyz23456', title: 'Once' });
        const first = await send().expect(201);
        const second = await send();
        expect([200, 201]).toContain(second.status);
        expect(second.body.lesson.uid).toBe(first.body.lesson.uid);
        expect(await LtdLesson.count()).toBe(1);
        expect(await LtdJournal.count({ where: { op: 'lesson_create' } })).toBe(
            1
        );
    });

    it('user A never sees, edits, reviews or deletes user B’s lessons', async () => {
        const b = await agentB
            .post('/api/lessons')
            .send({ title: 'B private' })
            .expect(201);
        const uid = b.body.lesson.uid;
        expect((await agentA.get('/api/lessons').expect(200)).body).toEqual({
            lessons: [],
        });
        await agentA
            .patch(`/api/lessons/${uid}`)
            .send({ title: 'x' })
            .expect(404);
        await agentA.delete(`/api/lessons/${uid}`).expect(404);
        await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'holds' })
            .expect(404);
        const still = await agentB.get('/api/lessons').expect(200);
        expect(still.body.lessons.map((l) => l.title)).toEqual(['B private']);
    });

    it('returns 404 for a goal, project, area or tag of another user and saves nothing', async () => {
        const foreign = {
            goal: await Goal.create({
                user_id: userB.id,
                title: 'B goal',
                horizon: 'year',
            }),
            project: await Project.create({
                user_id: userB.id,
                name: 'B project',
            }),
            area: await Area.create({ user_id: userB.id, name: 'B area' }),
            tag: await Tag.create({ user_id: userB.id, name: 'b-tag' }),
        };
        for (const [type, row] of Object.entries(foreign))
            await agentA
                .post('/api/lessons')
                .send({ title: 'Sneaky', links: [{ type, uid: row.uid }] })
                .expect(404);
        expect(await LtdLesson.count()).toBe(0);
        expect(await LtdLessonLink.count()).toBe(0);
        await agentA
            .get(`/api/lessons?goal_uid=${foreign.goal.uid}`)
            .expect(404);
        const own = await agentA
            .post('/api/lessons')
            .send({ title: 'Mine', links: [{ type: 'goal', uid: goal.uid }] })
            .expect(201);
        await agentA
            .patch(`/api/lessons/${own.body.lesson.uid}`)
            .send({ links: [{ type: 'goal', uid: foreign.goal.uid }] })
            .expect(404);
        const after = await agentA.get('/api/lessons').expect(200);
        expect(after.body.lessons[0].links).toEqual([
            { type: 'goal', uid: goal.uid, title: 'Spanish B1' },
        ]);
    });

    it('saves a fourth active lesson on the same goal with warning three_is_enough', async () => {
        const link = [{ type: 'goal', uid: goal.uid }];
        for (let i = 1; i <= 3; i++) {
            const res = await agentA
                .post('/api/lessons')
                .send({ title: `L${i}`, links: link })
                .expect(201);
            expect(res.body.warning).toBeUndefined();
        }
        const fourth = await agentA
            .post('/api/lessons')
            .send({ title: 'L4', links: link })
            .expect(201);
        expect(fourth.body.warning).toBe('three_is_enough');
        expect(await LtdLesson.count()).toBe(4);
        // A parked lesson does not count towards the three.
        await agentA
            .patch(`/api/lessons/${fourth.body.lesson.uid}`)
            .send({ status: 'parked' })
            .expect(200);
        const fifth = await agentA
            .post('/api/lessons')
            .send({ title: 'L5', links: link })
            .expect(201);
        expect(fifth.body.warning).toBe('three_is_enough');
        const listed = await agentA
            .get(`/api/lessons?goal_uid=${goal.uid}&status=active`)
            .expect(200);
        expect(listed.body.lessons).toHaveLength(4);
    });

    it('refuses deletion by an API token with 403', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({ title: 'Stay' })
            .expect(201);
        const {
            createApiToken,
        } = require('../../modules/users/apiTokenService');
        const { rawToken } = await createApiToken({ userId: userA.id });
        await request(app)
            .delete(`/api/lessons/${made.body.lesson.uid}`)
            .set('Authorization', `Bearer ${rawToken}`)
            .expect(403);
        expect(await LtdLesson.count()).toBe(1);
        const service = require('../../modules/ltd-lessons/service');
        await expect(
            service.remove(userA.id, made.body.lesson.uid, {
                actor_type: 'mcp',
            })
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(await LtdLesson.count()).toBe(1);
    });

    it('deletes for a human and Undo restores the lesson with its links and reviews', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({
                title: 'Keep',
                if_text: 'a',
                then_text: 'b',
                links: [{ type: 'goal', uid: goal.uid }],
            })
            .expect(201);
        const uid = made.body.lesson.uid;
        await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'not_yet', date: '2026-10-13', note: 'Soon' })
            .expect(201);
        const del = await agentA.delete(`/api/lessons/${uid}`).expect(200);
        expect(await LtdLesson.count()).toBe(0);
        expect(await LtdLessonCheck.count()).toBe(0);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [del.body.journal_uid] })
            .expect(200);
        const listed = await agentA.get('/api/lessons').expect(200);
        expect(listed.body.lessons).toEqual([
            expect.objectContaining({
                uid,
                title: 'Keep',
                if_text: 'a',
                then_text: 'b',
                review_on: '2026-10-20',
                links: [{ type: 'goal', uid: goal.uid, title: 'Spanish B1' }],
            }),
        ]);
        expect(await LtdLessonCheck.count()).toBe(1);
    });

    it('holds moves review 14 days, not_yet 7, park parks; each is undoable', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({ title: 'Review me', learned_on: '2026-09-01' })
            .expect(201);
        const uid = made.body.lesson.uid;
        const holds = await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'holds', date: '2026-10-13' })
            .expect(201);
        expect(holds.body.lesson.review_on).toBe(addDays('2026-10-13', 14));
        expect(holds.body.check).toMatchObject({
            verdict: 'holds',
            checked_on: '2026-10-13',
        });
        const notYet = await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'not_yet', date: '2026-10-27' })
            .expect(201);
        expect(notYet.body.lesson.review_on).toBe('2026-11-03');
        // Undo only the newest review first.
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [holds.body.journal_uid] })
            .expect(409);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [notYet.body.journal_uid] })
            .expect(200);
        let [lesson] = (await agentA.get('/api/lessons').expect(200)).body
            .lessons;
        expect(lesson.review_on).toBe('2026-10-27');
        const park = await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'park' })
            .expect(201);
        expect(park.body.lesson).toMatchObject({
            status: 'parked',
            review_on: null,
        });
        await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'holds' })
            .expect(409);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [park.body.journal_uid] })
            .expect(200);
        [lesson] = (await agentA.get('/api/lessons').expect(200)).body.lessons;
        expect(lesson).toMatchObject({
            status: 'active',
            review_on: '2026-10-27',
        });
        expect(await LtdLessonCheck.count()).toBe(1);
        await agentA
            .post(`/api/lessons/${uid}/checks`)
            .send({ verdict: 'maybe' })
            .expect(400);
    });

    it('undoes create and update, refusing an update undo after a newer edit', async () => {
        const made = await agentA
            .post('/api/lessons')
            .send({ title: 'Draft' })
            .expect(201);
        const uid = made.body.lesson.uid;
        await agentA
            .patch(`/api/lessons/${uid}`)
            .send({ title: 'Final', links: [{ type: 'goal', uid: goal.uid }] })
            .expect(200);
        const firstUpdate = await journalUid('lesson_update');
        await agentA
            .patch(`/api/lessons/${uid}`)
            .send({ title: 'Newer' })
            .expect(200);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [firstUpdate] })
            .expect(409);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [await journalUid('lesson_update')] })
            .expect(200);
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [firstUpdate] })
            .expect(200);
        const [lesson] = (await agentA.get('/api/lessons').expect(200)).body
            .lessons;
        expect(lesson).toMatchObject({ title: 'Draft', links: [] });
        await agentA
            .post('/api/journal/revert')
            .send({ uids: [await journalUid('lesson_create')] })
            .expect(200);
        expect(await LtdLesson.count()).toBe(0);
    });

    it('asks at most one review a day: the oldest due active lesson', async () => {
        for (const [title, review_on] of [
            ['Later', '2026-10-20'],
            ['Old', '2026-10-01'],
            ['Older', '2026-09-20'],
        ])
            await agentA
                .post('/api/lessons')
                .send({ title, review_on })
                .expect(201);
        const res = await agentA
            .get('/api/lessons/due?date=2026-10-13')
            .expect(200);
        expect(res.body.date).toBe('2026-10-13');
        expect(res.body.lesson.title).toBe('Older');
        const none = await agentA
            .get('/api/lessons/due?date=2026-09-01')
            .expect(200);
        expect(none.body.lesson).toBeNull();
        // Once answered, no second question that day; the next one is tomorrow.
        await agentA
            .post(`/api/lessons/${res.body.lesson.uid}/checks`)
            .send({ verdict: 'not_yet', date: '2026-10-13' })
            .expect(201);
        const afterAnswer = await agentA
            .get('/api/lessons/due?date=2026-10-13')
            .expect(200);
        expect(afterAnswer.body.lesson).toBeNull();
        const tomorrow = await agentA
            .get('/api/lessons/due?date=2026-10-14')
            .expect(200);
        expect(tomorrow.body.lesson.title).toBe('Old');
        expect(
            (await agentB.get('/api/lessons/due?date=2026-12-01').expect(200))
                .body.lesson
        ).toBeNull();
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/lessons').expect(401);
        expect(res.body.lessons).toBeUndefined();
        await request(app).get('/api/lessons/effect?task_uid=x').expect(401);
    });
});

describe('Phase 11 task effect API', () => {
    let user, agent, vision, fiveYear, year;
    beforeEach(async () => {
        user = await createTestUser({ email: 'effect@example.com' });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        vision = await Goal.create({
            user_id: user.id,
            title: 'A bilingual life',
            horizon: 'vision',
            why: 'Live in two languages',
        });
        fiveYear = await Goal.create({
            user_id: user.id,
            title: 'Work in Spanish',
            horizon: 'five_year',
            parent_goal_id: vision.id,
            why: 'Choose where I work',
        });
        year = await Goal.create({
            user_id: user.id,
            title: 'Spanish B1',
            horizon: 'year',
            parent_goal_id: fiveYear.id,
        });
        await LtdGoalMetric.create({
            goal_id: year.id,
            name: 'Score',
            baseline: 0,
            target: 100,
            current_value: 40,
        });
    });

    it('shows the path and outcome, keeps O after completion, and one linked lesson', async () => {
        const task = await Task.create({
            user_id: user.id,
            name: 'Practice',
            goal_id: year.id,
        });
        const other = await Task.create({ user_id: user.id, name: 'Laundry' });
        const lesson = await agent
            .post('/api/lessons')
            .send({
                title: 'Short sessions',
                if_text: 'I sit down to study',
                then_text: 'I set a 20 minute timer',
                links: [{ type: 'goal', uid: year.uid }],
            })
            .expect(201);
        const before = await agent
            .get(`/api/lessons/effect?task_uid=${task.uid}`)
            .expect(200);
        expect(before.body).toMatchObject({
            kind: 'linked',
            fiveYear: { uid: fiveYear.uid, title: 'Work in Spanish' },
            vision: { uid: vision.uid },
            meaning: 'Choose where I work',
            outcome: { goal_uid: year.uid, value: 0.4 },
            lesson: {
                uid: lesson.body.lesson.uid,
                if_text: 'I sit down to study',
                then_text: 'I set a 20 minute timer',
            },
        });
        await agent
            .patch(`/api/task/${task.uid}`)
            .send({ status: 'done' })
            .expect(200);
        expect((await Task.findByPk(task.id)).status).toBe(2);
        const after = await agent
            .get(`/api/lessons/effect?task_uid=${task.uid}`)
            .expect(200);
        expect(after.body.outcome).toEqual(before.body.outcome);

        const unrelated = await agent
            .get(`/api/lessons/effect?task_uid=${other.uid}`)
            .expect(200);
        expect(unrelated.body).toMatchObject({
            kind: 'unlinked',
            outcome: null,
            lesson: null,
        });
    });

    it('a shared tag brings a lesson; another user’s task is 404', async () => {
        const tag = await Tag.create({ user_id: user.id, name: 'deep-work' });
        const task = await Task.create({ user_id: user.id, name: 'Write' });
        await task.addTag(tag);
        await agent
            .post('/api/lessons')
            .send({
                title: 'Phone in another room',
                links: [{ type: 'tag', uid: tag.uid }],
            })
            .expect(201);
        const res = await agent
            .get(`/api/lessons/effect?task_uid=${task.uid}`)
            .expect(200);
        expect(res.body.lesson.title).toBe('Phone in another room');
        const stranger = await createTestUser({
            email: 'stranger@example.com',
        });
        const hidden = await Task.create({ user_id: stranger.id, name: 'x' });
        await agent
            .get(`/api/lessons/effect?task_uid=${hidden.uid}`)
            .expect(404);
        await agent.get('/api/lessons/effect').expect(400);
    });
});
