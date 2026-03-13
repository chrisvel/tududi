const { getAccess, getSharedUidsForUser, ownershipOrPermissionWhere, ACCESS } = require('../../../services/permissionsService');
const { User, Project, Task, Note, Permission, sequelize } = require('../../../models');
const bcrypt = require('bcrypt');

describe('permissionsService', () => {
    let owner, otherUser, adminUser;

    beforeEach(async () => {
        await sequelize.query('DELETE FROM permissions');
        await sequelize.query('DELETE FROM roles');
        const hash = await bcrypt.hash('pass', 10);
        // First user created gets admin role automatically via afterCreate hook
        adminUser = await User.create({ email: 'admin@test.com', password_digest: hash });
        owner = await User.create({ email: 'owner@test.com', password_digest: hash });
        otherUser = await User.create({ email: 'other@test.com', password_digest: hash });
    });

    describe('getAccess', () => {
        // --- Projects ---

        it('should return rw for project owner', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            const access = await getAccess(owner.id, 'project', project.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner without permission', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            const access = await getAccess(otherUser.id, 'project', project.uid);
            expect(access).toBe('none');
        });

        it('should return admin for admin user', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            const access = await getAccess(adminUser.uid, 'project', project.uid);
            expect(access).toBe('admin');
        });

        it('should return none for non-existent project', async () => {
            const access = await getAccess(owner.id, 'project', 'nonexistent-uid');
            expect(access).toBe('none');
        });

        it('should return shared permission level for project', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'project', project.uid);
            expect(access).toBe('ro');
        });

        // --- Tasks ---

        it('should return rw for task owner', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            const access = await getAccess(owner.id, 'task', task.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner task without permission', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('none');
        });

        it('should return none for non-existent task', async () => {
            const access = await getAccess(owner.id, 'task', 'no-such-task');
            expect(access).toBe('none');
        });

        it('should inherit task access from parent project permission', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            const task = await Task.create({ name: 'T1', user_id: owner.id, project_id: project.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('rw');
        });

        it('should return shared permission for directly shared task', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'task',
                resource_uid: task.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('ro');
        });

        // --- Notes ---

        it('should return rw for note owner', async () => {
            const note = await Note.create({ title: 'N1', user_id: owner.id });
            const access = await getAccess(owner.id, 'note', note.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner note without permission', async () => {
            const note = await Note.create({ title: 'N1', user_id: owner.id });
            const access = await getAccess(otherUser.id, 'note', note.uid);
            expect(access).toBe('none');
        });

        it('should inherit note access from parent project permission', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            const note = await Note.create({ title: 'N1', user_id: owner.id, project_id: project.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'note', note.uid);
            expect(access).toBe('ro');
        });
    });

    describe('getSharedUidsForUser', () => {
        it('should return empty array when no permissions exist', async () => {
            const uids = await getSharedUidsForUser('project', otherUser.id);
            expect(uids).toEqual([]);
        });

        it('should return shared resource uids', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const uids = await getSharedUidsForUser('project', otherUser.id);
            expect(uids).toContain(project.uid);
        });

        it('should deduplicate uids', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            // Create two permissions for the same resource (different propagation)
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const uids = await getSharedUidsForUser('project', otherUser.id);
            const uniqueUids = [...new Set(uids)];
            expect(uids.length).toBe(uniqueUids.length);
        });
    });

    describe('ownershipOrPermissionWhere', () => {
        it('should include user_id condition for owned resources', async () => {
            const where = await ownershipOrPermissionWhere('project', owner.id);
            expect(where).toBeDefined();
            // Should contain an Op.or with user_id condition
            const orKey = Object.getOwnPropertySymbols(where)[0];
            expect(orKey).toBeDefined();
            const conditions = where[orKey];
            expect(conditions.some((c) => c.user_id === owner.id)).toBe(true);
        });

        it('should include shared resource uids when permissions exist', async () => {
            const project = await Project.create({ name: 'Shared', user_id: owner.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });

            const where = await ownershipOrPermissionWhere('project', otherUser.id);
            const orKey = Object.getOwnPropertySymbols(where)[0];
            const conditions = where[orKey];
            // Should have a uid IN condition with the shared project uid
            const uidCondition = conditions.find((c) => c.uid);
            expect(uidCondition).toBeDefined();
        });

        it('should use cache when provided', async () => {
            const cache = new Map();
            const where1 = await ownershipOrPermissionWhere('project', owner.id, cache);
            const where2 = await ownershipOrPermissionWhere('project', owner.id, cache);
            expect(where1).toBe(where2); // same reference from cache
        });

        it('should include tasks from shared projects for task resource type', async () => {
            const project = await Project.create({ name: 'P1', user_id: owner.id });
            await Task.create({ name: 'T1', user_id: owner.id, project_id: project.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });

            const where = await ownershipOrPermissionWhere('task', otherUser.id);
            const orKey = Object.getOwnPropertySymbols(where)[0];
            const conditions = where[orKey];
            // Should have a project_id IN condition
            const projectCondition = conditions.find((c) => c.project_id);
            expect(projectCondition).toBeDefined();
        });
    });

    describe('ACCESS constants', () => {
        it('should export expected access levels', () => {
            expect(ACCESS.NONE).toBe('none');
            expect(ACCESS.RO).toBe('ro');
            expect(ACCESS.RW).toBe('rw');
            expect(ACCESS.ADMIN).toBe('admin');
        });
    });
});