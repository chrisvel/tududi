'use strict';
const { createTestUser } = require('../helpers/testUtils');
const { Goal, sequelize } = require('../../models');
const service = require('../../modules/goals/service');
const hierarchy = require('../../modules/ltd-progress/hierarchy');
const progress = require('../../modules/ltd-progress/service');
const journal = require('../../modules/ltd-journal/service');

let user, other;
beforeEach(async () => {
    user = await createTestUser({ email: 'hierarchy@example.com' });
    other = await createTestUser({ email: 'other-hierarchy@example.com' });
});

it('validates parent UID, preserves defaults, rejects foreign parents and clears parents', async () => {
    const parent = await service.create(user.id, {
        title: 'Year',
        horizon: 'year',
    });
    const child = await service.create(user.id, {
        title: 'Season',
        parent_goal_uid: parent.uid,
    });
    expect(child.horizon).toBe('season');
    expect(child.parent_goal_id).toBe(parent.id);
    expect(child.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(
        service.create(other.id, {
            title: 'Foreign child',
            parent_goal_id: parent.id,
        })
    ).rejects.toThrow('Invalid parent');
    await expect(
        service.create(other.id, {
            title: 'Foreign child',
            parent_goal_uid: parent.uid,
        })
    ).rejects.toThrow('Invalid parent');
    await expect(
        service.update(user.id, parent.uid, { parent_goal_id: child.id })
    ).rejects.toThrow('cycle');
    await expect(
        service.update(user.id, parent.uid, { horizon: 'week' })
    ).rejects.toThrow('longer');
    expect((await parent.reload()).horizon).toBe('year');
    const moved = await service.update(user.id, child.uid, {
        parent_goal_uid: null,
    });
    expect(moved.parent_goal_id).toBeNull();
    await service.update(user.id, child.uid, {
        parent_goal_uid: parent.uid,
        parent_goal_id: parent.id,
    });
    const entries = await journal.list(user.id);
    await journal.revert(user.id, [entries[0].uid]);
    expect((await child.reload()).parent_goal_id).toBeNull();
    await expect(
        service.update(user.id, child.uid, {
            parent_goal_uid: parent.uid,
            parent_goal_id: 99,
        })
    ).rejects.toThrow('Conflicting');
    await expect(
        service.update(user.id, child.uid, { parent_goal_id: '99' })
    ).rejects.toThrow('Invalid parent');
    await expect(
        service.update(user.id, child.uid, { parent_goal_id: 0 })
    ).rejects.toThrow('Invalid parent');
    await expect(
        service.update(user.id, child.uid, { period_start: '2026-02-30' })
    ).rejects.toThrow('valid ISO');
});
it('rejects a longer horizon beneath a shorter horizon explicitly and rolls back', async () => {
    const season = await service.create(user.id, { title: 'Season' });
    await expect(
        service.create(user.id, {
            title: 'Year',
            horizon: 'year',
            parent_goal_id: season.id,
        })
    ).rejects.toThrow('Parent horizon must be longer');
    expect(await Goal.count({ where: { user_id: user.id } })).toBe(1);
    expect((await journal.list(user.id)).length).toBe(1);
});
it('only explicit human achievement sets its timestamp; projection never changes it', async () => {
    const goal = await service.create(user.id, {
        title: 'Goal',
        horizon: 'week',
        period_start: '2020-01-01',
        period_end: '2020-01-07',
    });
    expect(
        (await progress.progress(user.id, goal.uid)).achievement_suggested
    ).toBe(true);
    expect((await goal.reload()).status).toBe('active');
    await expect(
        service.update(
            user.id,
            goal.uid,
            { status: 'achieved' },
            { user_id: user.id, actor_type: 'mcp' }
        )
    ).rejects.toThrow('Only a user');
    await expect(
        service.create(
            user.id,
            { title: 'Robot', status: 'achieved' },
            { user_id: user.id, actor_type: 'ai' }
        )
    ).rejects.toThrow('Only a user');
    const achieved = await service.update(user.id, goal.uid, {
        status: 'achieved',
    });
    expect(achieved.achieved_at).toBeInstanceOf(Date);
    await service.update(user.id, goal.uid, { status: 'active' });
    expect((await goal.reload()).achieved_at).toBeNull();
});
it('guards missing user/goal and detects ownership in the hierarchy service', async () => {
    await sequelize.transaction(async (transaction) => {
        await expect(hierarchy.lockOwner(999999, transaction)).rejects.toThrow(
            'User not found'
        );
        await expect(
            hierarchy.validateHierarchy(user.id, 999999, {}, transaction)
        ).rejects.toThrow('Goal not found');
        expect(
            await hierarchy.resolveParent(
                user.id,
                { parent_goal_uid: '' },
                transaction
            )
        ).toBeNull();
        expect(
            await hierarchy.resolveParent(
                user.id,
                { parent_goal_id: '' },
                transaction
            )
        ).toBeNull();
    });
});
it('preserves SET NULL on physical human deletion of a parent', async () => {
    const parent = await service.create(user.id, {
        title: 'Parent',
        horizon: 'year',
    });
    const child = await service.create(user.id, {
        title: 'Child',
        parent_goal_id: parent.id,
    });
    // The SQLite test harness disables FK checks; explicitly enable the actual constraint.
    const { isSqlite } = require('../../utils/db-dialect');
    if (isSqlite()) await sequelize.query('PRAGMA foreign_keys = ON');
    await parent.destroy();
    expect((await child.reload()).parent_goal_id).toBeNull();
});
