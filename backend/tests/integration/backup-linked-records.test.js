const {
    Area,
    Goal,
    Project,
    Task,
    Person,
    Role,
    User,
    Comment,
    CommentReaction,
    TaskRelation,
    DailyPlan,
    DailyPlanItem,
    CalendarFeed,
    Webhook,
    UserTaskOrder,
    UserProjectOrder,
    UserAreaOrder,
    UserGoalOrder,
    UserProjectArea,
} = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const {
    exportUserData,
    importUserData,
} = require('../../services/userDataTransfer');
const { createTestUser } = require('../helpers/testUtils');
const { eraseUserAccount } = require('../../services/accountErasureService');

const KEY_ENV = 'TUDUDI_OIDC_SECRET_ENCRYPTION_KEY';

// Comments with a reply, a mention and a reaction, a relation, a daily plan,
// a calendar feed, a webhook and every saved order, all on one account.
async function seedAccount() {
    const stamp = Date.now();
    const user = await createTestUser({
        email: `linked_${stamp}@example.com`,
    });
    const area = await Area.create({ name: 'Home', user_id: user.id });
    const goal = await Goal.create({ title: 'Calm', user_id: user.id });
    const project = await Project.create({
        name: 'Kitchen',
        user_id: user.id,
        area_id: area.id,
    });
    const paint = await Task.create({
        name: 'Paint walls',
        user_id: user.id,
        project_id: project.id,
    });
    const tiles = await Task.create({
        name: 'Lay tiles',
        user_id: user.id,
        project_id: project.id,
    });
    const alex = await Person.create({ name: 'Alex', user_id: user.id });

    const comment = await Comment.create({
        task_id: paint.id,
        user_id: user.id,
        body: 'Ask @Alex about colours',
        mentioned_person_uids: [alex.uid],
        created_at: new Date('2026-01-02T10:00:00Z'),
    });
    await Comment.create({
        task_id: paint.id,
        user_id: user.id,
        body: 'Grey it is',
        parent_comment_id: comment.id,
    });
    await CommentReaction.create({
        comment_id: comment.id,
        user_id: user.id,
        reaction_type: 'like',
    });
    await TaskRelation.create({
        source_task_id: paint.id,
        target_task_id: tiles.id,
        relation_type: 'blocks',
        created_by_user_id: user.id,
    });
    const plan = await DailyPlan.create({
        user_id: user.id,
        plan_date: '2026-01-02',
    });
    await DailyPlanItem.create({
        daily_plan_id: plan.id,
        task_id: paint.id,
        position: 1,
        start_minute: 540,
        duration_minutes: 90,
    });
    await CalendarFeed.create({
        user_id: user.id,
        name: 'Work',
        url_encrypted: secretCipher.encrypt('https://cal.example.com/a.ics'),
        url_host: 'cal.example.com',
    });
    await Webhook.create({
        user_id: user.id,
        name: 'n8n',
        url: secretCipher.encrypt('https://hooks.example.com/x'),
        secret: secretCipher.encrypt('whsec_test'),
        events: ['task.completed'],
        summary_hour: 7,
    });
    await UserTaskOrder.create({
        user_id: user.id,
        task_id: tiles.id,
        scope: 'all',
        position: 0,
    });
    await UserTaskOrder.create({
        user_id: user.id,
        task_id: tiles.id,
        scope: `project:${project.id}`,
        position: 3,
    });
    await UserProjectOrder.create({
        user_id: user.id,
        project_id: project.id,
        position: 2,
    });
    await UserAreaOrder.create({
        user_id: user.id,
        area_id: area.id,
        position: 4,
    });
    await UserGoalOrder.create({
        user_id: user.id,
        goal_id: goal.id,
        position: 5,
    });
    await UserProjectArea.create({
        user_id: user.id,
        project_id: project.id,
        area_id: area.id,
    });
    return { user, area, goal, project, paint, tiles, alex, comment };
}

describe('Backup of comments, plans, feeds, webhooks and orders', () => {
    const savedKey = process.env[KEY_ENV];
    let seeded;
    let target;

    beforeEach(async () => {
        process.env[KEY_ENV] = 'linked-records-test-key';
        seeded = await seedAccount();
        target = await createTestUser({
            email: `linked-target_${Date.now()}@example.com`,
        });
    });

    afterEach(() => {
        if (savedKey === undefined) delete process.env[KEY_ENV];
        else process.env[KEY_ENV] = savedKey;
    });

    it('exports them by uid, with secrets still encrypted', async () => {
        const backup = await exportUserData(seeded.user.id);
        const d = backup.data;

        const top = d.comments.find((c) => c.uid === seeded.comment.uid);
        expect(top.task_uid).toBe(seeded.paint.uid);
        expect(top.mentioned_person_uids).toEqual([seeded.alex.uid]);
        const reply = d.comments.find((c) => c.body === 'Grey it is');
        expect(reply.parent_comment_uid).toBe(seeded.comment.uid);
        expect(d.comment_reactions).toEqual([
            { comment_uid: seeded.comment.uid, reaction_type: 'like' },
        ]);
        expect(d.task_relations[0]).toMatchObject({
            source_task_uid: seeded.paint.uid,
            target_task_uid: seeded.tiles.uid,
            relation_type: 'blocks',
        });
        expect(d.daily_plans[0].items).toEqual([
            {
                task_uid: seeded.paint.uid,
                position: 1,
                start_minute: 540,
                duration_minutes: 90,
            },
        ]);
        expect(
            secretCipher.isEncrypted(d.calendar_feeds[0].url_encrypted)
        ).toBe(true);
        expect(secretCipher.isEncrypted(d.webhooks[0].secret)).toBe(true);
        expect(d.task_orders).toEqual(
            expect.arrayContaining([
                {
                    task_uid: seeded.tiles.uid,
                    scope: 'all',
                    project_uid: null,
                    position: 0,
                },
                {
                    task_uid: seeded.tiles.uid,
                    scope: 'project',
                    project_uid: seeded.project.uid,
                    position: 3,
                },
            ])
        );
        expect(d.project_areas).toEqual([
            { project_uid: seeded.project.uid, area_uid: seeded.area.uid },
        ]);
        expect(JSON.stringify(d)).not.toContain('whsec_test');
    });

    it('imports them into another account linked to the new rows', async () => {
        const backup = await exportUserData(seeded.user.id);
        const stats = await importUserData(target.id, backup);

        expect(stats.comments).toEqual({ created: 2, skipped: 0 });
        expect(stats.task_relations).toEqual({ created: 1, skipped: 0 });
        expect(stats.daily_plans).toEqual({ created: 1, skipped: 0 });
        expect(stats.calendar_feeds).toEqual({ created: 1, skipped: 0 });
        expect(stats.webhooks).toEqual({ created: 1, skipped: 0 });
        expect(stats.orders).toEqual({ created: 6, skipped: 0 });

        const paint = await Task.findOne({
            where: { user_id: target.id, name: 'Paint walls' },
        });
        const tiles = await Task.findOne({
            where: { user_id: target.id, name: 'Lay tiles' },
        });
        const project = await Project.findOne({
            where: { user_id: target.id, name: 'Kitchen' },
        });
        const area = await Area.findOne({
            where: { user_id: target.id, name: 'Home' },
        });
        const goal = await Goal.findOne({
            where: { user_id: target.id, title: 'Calm' },
        });
        const alex = await Person.findOne({
            where: { user_id: target.id, name: 'Alex' },
        });

        const comments = await Comment.findAll({
            where: { user_id: target.id },
            order: [['id', 'ASC']],
        });
        expect(comments.map((c) => c.task_id)).toEqual([paint.id, paint.id]);
        const top = comments.find((c) => c.body.startsWith('Ask'));
        const reply = comments.find((c) => c.body === 'Grey it is');
        expect(top.uid).not.toBe(seeded.comment.uid);
        expect(top.mentioned_person_uids).toEqual([alex.uid]);
        expect(new Date(top.created_at).toISOString()).toBe(
            '2026-01-02T10:00:00.000Z'
        );
        expect(reply.parent_comment_id).toBe(top.id);
        const reaction = await CommentReaction.findOne({
            where: { user_id: target.id },
        });
        expect(reaction.comment_id).toBe(top.id);

        const relation = await TaskRelation.findOne({
            where: { source_task_id: paint.id },
        });
        expect(relation.target_task_id).toBe(tiles.id);
        expect(relation.created_by_user_id).toBe(target.id);

        const plan = await DailyPlan.findOne({
            where: { user_id: target.id },
            include: [{ model: DailyPlanItem, as: 'Items' }],
        });
        expect(plan.plan_date).toBe('2026-01-02');
        expect(plan.Items.map((i) => [i.task_id, i.duration_minutes])).toEqual([
            [paint.id, 90],
        ]);

        const feed = await CalendarFeed.findOne({
            where: { user_id: target.id },
        });
        expect(secretCipher.decrypt(feed.url_encrypted)).toBe(
            'https://cal.example.com/a.ics'
        );
        const webhook = await Webhook.findOne({
            where: { user_id: target.id },
        });
        expect(secretCipher.decrypt(webhook.secret)).toBe('whsec_test');
        expect(webhook.events).toEqual(['task.completed']);
        expect(webhook.summary_hour).toBe(7);

        const scopes = (
            await UserTaskOrder.findAll({ where: { user_id: target.id } })
        ).map((o) => [o.task_id, o.scope, o.position]);
        expect(scopes).toEqual(
            expect.arrayContaining([
                [tiles.id, 'all', 0],
                [tiles.id, `project:${project.id}`, 3],
            ])
        );
        expect(
            (await UserProjectOrder.findOne({ where: { user_id: target.id } }))
                .project_id
        ).toBe(project.id);
        expect(
            (await UserAreaOrder.findOne({ where: { user_id: target.id } }))
                .area_id
        ).toBe(area.id);
        expect(
            (await UserGoalOrder.findOne({ where: { user_id: target.id } }))
                .goal_id
        ).toBe(goal.id);
        const placement = await UserProjectArea.findOne({
            where: { user_id: target.id },
        });
        expect([placement.project_id, placement.area_id]).toEqual([
            project.id,
            area.id,
        ]);
    });

    it('restoring a backup onto its own account adds nothing', async () => {
        const backup = await exportUserData(seeded.user.id);
        const stats = await importUserData(seeded.user.id, backup);

        for (const key of [
            'comments',
            'daily_plans',
            'calendar_feeds',
            'webhooks',
        ]) {
            expect(stats[key].created).toBe(0);
        }
        expect(stats.orders.created).toBe(0);
        expect(
            await Comment.count({ where: { user_id: seeded.user.id } })
        ).toBe(2);
        expect(
            await DailyPlanItem.count({
                include: [
                    {
                        model: DailyPlan,
                        as: 'DailyPlan',
                        where: { user_id: seeded.user.id },
                    },
                ],
            })
        ).toBe(1);
    });

    it('skips feeds and webhooks this instance cannot decrypt', async () => {
        const backup = await exportUserData(seeded.user.id);
        process.env[KEY_ENV] = 'a-different-instance-key';

        const stats = await importUserData(target.id, backup);

        expect(stats.calendar_feeds).toEqual({ created: 0, skipped: 1 });
        expect(stats.webhooks).toEqual({ created: 0, skipped: 1 });
        expect(
            await CalendarFeed.count({ where: { user_id: target.id } })
        ).toBe(0);
        expect(stats.comments.created).toBe(2);
    });

    it('still imports a backup made before these records were exported', async () => {
        const backup = await exportUserData(seeded.user.id);
        for (const key of [
            'comments',
            'comment_reactions',
            'task_relations',
            'daily_plans',
            'calendar_feeds',
            'webhooks',
            'task_orders',
            'project_orders',
            'area_orders',
            'goal_orders',
            'project_areas',
        ]) {
            delete backup.data[key];
        }

        const stats = await importUserData(target.id, backup);

        expect(stats.tasks.created).toBe(2);
        expect(stats.comments).toEqual({ created: 0, skipped: 0 });
        expect(await Comment.count({ where: { user_id: target.id } })).toBe(0);
    });

    it('does not import them when merge is disabled', async () => {
        const backup = await exportUserData(seeded.user.id);
        await importUserData(target.id, backup, { merge: false });
        expect(await Comment.count({ where: { user_id: target.id } })).toBe(0);
        expect(await Webhook.count({ where: { user_id: target.id } })).toBe(0);
    });
});

describe('Instance backup of records across accounts', () => {
    const savedKey = process.env[KEY_ENV];

    beforeEach(() => {
        process.env[KEY_ENV] = 'linked-records-test-key';
    });

    afterEach(() => {
        if (savedKey === undefined) delete process.env[KEY_ENV];
        else process.env[KEY_ENV] = savedKey;
    });

    it("restores a member's comment and plan on the admin's task, and the admin's reaction to it", async () => {
        const stamp = Date.now();
        const admin = await createTestUser({
            email: `linked-admin_${stamp}@example.com`,
        });
        const member = await createTestUser({
            email: `linked-member_${stamp}@example.com`,
        });
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true, role: 'admin' });
        await Role.create({
            user_id: member.id,
            is_admin: false,
            role: 'user',
        });

        const task = await Task.create({
            name: 'Book the venue',
            user_id: admin.id,
        });
        const comment = await Comment.create({
            task_id: task.id,
            user_id: member.id,
            body: 'Called them, waiting',
        });
        await CommentReaction.create({
            comment_id: comment.id,
            user_id: admin.id,
            reaction_type: 'like',
        });
        const plan = await DailyPlan.create({
            user_id: member.id,
            plan_date: '2026-02-01',
        });
        await DailyPlanItem.create({
            daily_plan_id: plan.id,
            task_id: task.id,
        });

        const backup = await exportUserData(admin.id);
        const freshAdmin = await createTestUser({
            email: `linked-fresh_${stamp}@example.com`,
        });
        await Role.destroy({ where: { user_id: freshAdmin.id } });
        await Role.create({
            user_id: freshAdmin.id,
            is_admin: true,
            role: 'admin',
        });
        for (const user of [member, admin]) {
            await eraseUserAccount(user.id);
        }

        const stats = await importUserData(freshAdmin.id, backup);
        expect(stats.accounts.created).toBe(1);

        const restoredMember = await User.findOne({
            where: { uid: member.uid },
        });
        const restoredTask = await Task.findOne({
            where: { user_id: freshAdmin.id, name: 'Book the venue' },
        });
        const restoredComment = await Comment.findOne({
            where: { user_id: restoredMember.id },
        });
        expect(restoredComment.task_id).toBe(restoredTask.id);
        const reaction = await CommentReaction.findOne({
            where: { comment_id: restoredComment.id },
        });
        expect(reaction.user_id).toBe(freshAdmin.id);
        const restoredPlan = await DailyPlan.findOne({
            where: { user_id: restoredMember.id },
            include: [{ model: DailyPlanItem, as: 'Items' }],
        });
        expect(restoredPlan.Items.map((i) => i.task_id)).toEqual([
            restoredTask.id,
        ]);
    });
});
