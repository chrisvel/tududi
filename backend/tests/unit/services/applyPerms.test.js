const { applyPerms } = require('../../../services/applyPerms');
const { sequelize, Permission, User } = require('../../../models');
const bcrypt = require('bcrypt');

describe('applyPerms', () => {
    let owner, target;

    beforeEach(async () => {
        await sequelize.query('DELETE FROM permissions');
        const hash = await bcrypt.hash('pass', 10);
        owner = await User.create({ email: 'owner@test.com', password_digest: hash });
        target = await User.create({ email: 'target@test.com', password_digest: hash });
    });

    it('should create a new permission on upsert when none exists', async () => {
        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [{
                    userId: target.id,
                    resourceType: 'project',
                    resourceUid: 'proj-uid-1',
                    accessLevel: 'ro',
                    propagation: 'direct',
                    grantedByUserId: owner.id,
                }],
                deletes: [],
            });
        });

        const perm = await Permission.findOne({
            where: { user_id: target.id, resource_type: 'project', resource_uid: 'proj-uid-1' },
        });
        expect(perm).not.toBeNull();
        expect(perm.access_level).toBe('ro');
        expect(perm.propagation).toBe('direct');
        expect(perm.granted_by_user_id).toBe(owner.id);
    });

    it('should upgrade access level on upsert when permission already exists (ro -> rw)', async () => {
        // Create existing ro permission
        await Permission.create({
            user_id: target.id,
            resource_type: 'project',
            resource_uid: 'proj-uid-2',
            access_level: 'ro',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [{
                    userId: target.id,
                    resourceType: 'project',
                    resourceUid: 'proj-uid-2',
                    accessLevel: 'rw',
                    grantedByUserId: owner.id,
                }],
                deletes: [],
            });
        });

        const perm = await Permission.findOne({
            where: { user_id: target.id, resource_type: 'project', resource_uid: 'proj-uid-2' },
        });
        expect(perm.access_level).toBe('rw');
    });

    it('should keep rw when upserting ro on existing rw permission', async () => {
        await Permission.create({
            user_id: target.id,
            resource_type: 'project',
            resource_uid: 'proj-uid-3',
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [{
                    userId: target.id,
                    resourceType: 'project',
                    resourceUid: 'proj-uid-3',
                    accessLevel: 'ro',
                    grantedByUserId: owner.id,
                }],
                deletes: [],
            });
        });

        const perm = await Permission.findOne({
            where: { user_id: target.id, resource_type: 'project', resource_uid: 'proj-uid-3' },
        });
        expect(perm.access_level).toBe('rw');
    });

    it('should delete a permission', async () => {
        await Permission.create({
            user_id: target.id,
            resource_type: 'task',
            resource_uid: 'task-uid-1',
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [],
                deletes: [{
                    userId: target.id,
                    resourceType: 'task',
                    resourceUid: 'task-uid-1',
                }],
            });
        });

        const perm = await Permission.findOne({
            where: { user_id: target.id, resource_type: 'task', resource_uid: 'task-uid-1' },
        });
        expect(perm).toBeNull();
    });

    it('should handle empty upserts and deletes', async () => {
        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, { upserts: [], deletes: [] });
        });
        // No error thrown
    });

    it('should handle multiple upserts and deletes in one call', async () => {
        await Permission.create({
            user_id: target.id,
            resource_type: 'note',
            resource_uid: 'note-to-delete',
            access_level: 'ro',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [
                    {
                        userId: target.id,
                        resourceType: 'project',
                        resourceUid: 'new-proj',
                        accessLevel: 'rw',
                        propagation: 'direct',
                        grantedByUserId: owner.id,
                    },
                    {
                        userId: target.id,
                        resourceType: 'task',
                        resourceUid: 'new-task',
                        accessLevel: 'ro',
                        propagation: 'inherited',
                        grantedByUserId: owner.id,
                    },
                ],
                deletes: [
                    {
                        userId: target.id,
                        resourceType: 'note',
                        resourceUid: 'note-to-delete',
                    },
                ],
            });
        });

        const projPerm = await Permission.findOne({
            where: { user_id: target.id, resource_uid: 'new-proj' },
        });
        const taskPerm = await Permission.findOne({
            where: { user_id: target.id, resource_uid: 'new-task' },
        });
        const notePerm = await Permission.findOne({
            where: { user_id: target.id, resource_uid: 'note-to-delete' },
        });

        expect(projPerm).not.toBeNull();
        expect(projPerm.access_level).toBe('rw');
        expect(taskPerm).not.toBeNull();
        expect(taskPerm.access_level).toBe('ro');
        expect(taskPerm.propagation).toBe('inherited');
        expect(notePerm).toBeNull();
    });

    it('should set default propagation to direct when not specified', async () => {
        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [{
                    userId: target.id,
                    resourceType: 'project',
                    resourceUid: 'proj-default',
                    accessLevel: 'ro',
                    grantedByUserId: owner.id,
                    // no propagation
                }],
                deletes: [],
            });
        });

        const perm = await Permission.findOne({
            where: { user_id: target.id, resource_uid: 'proj-default' },
        });
        expect(perm.propagation).toBe('direct');
    });

    it('should not fail when deleting a non-existent permission', async () => {
        await sequelize.transaction(async (tx) => {
            await applyPerms(tx, {
                upserts: [],
                deletes: [{
                    userId: target.id,
                    resourceType: 'project',
                    resourceUid: 'does-not-exist',
                }],
            });
        });
        // Should not throw
    });
});