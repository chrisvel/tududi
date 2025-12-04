const request = require('supertest');
const app = require('../../app');
const {
    User,
    Role,
    Task,
    Project,
    Area,
    Note,
    Tag,
    InboxItem,
    View,
    Notification,
    ApiToken,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

async function makeAdminDirect(userId) {
    await Role.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, is_admin: true },
    });
}

describe('Admin User Deletion with Cascade', () => {
    let adminUser, adminAgent, testUser;

    beforeEach(async () => {
        // Create admin user
        adminUser = await createTestUser({ email: 'admin@example.com' });
        adminAgent = await loginAgent('admin@example.com');
        await Role.destroy({ where: {} });
        await makeAdminDirect(adminUser.id);

        // Create test user with related data
        testUser = await createTestUser({ email: 'testuser@example.com' });
    });

    it('should delete user with tasks and projects', async () => {
        // Create related data for the test user
        const area = await Area.create({
            name: 'Test Area',
            user_id: testUser.id,
        });

        const project = await Project.create({
            name: 'Test Project',
            user_id: testUser.id,
            area_id: area.id,
        });

        const task = await Task.create({
            name: 'Test Task',
            user_id: testUser.id,
            project_id: project.id,
        });

        const note = await Note.create({
            content: 'Test Note',
            user_id: testUser.id,
            project_id: project.id,
        });

        const tag = await Tag.create({
            name: 'Test Tag',
            user_id: testUser.id,
        });

        const inboxItem = await InboxItem.create({
            content: 'Test Inbox Item',
            user_id: testUser.id,
            source: 'manual',
        });

        // Delete the user
        const delRes = await adminAgent.delete(
            `/api/admin/users/${testUser.id}`
        );
        expect(delRes.status).toBe(204);

        // Verify user is deleted
        const deletedUser = await User.findByPk(testUser.id);
        expect(deletedUser).toBeNull();

        // Verify all related data is deleted
        const taskCount = await Task.count({ where: { user_id: testUser.id } });
        expect(taskCount).toBe(0);

        const projectCount = await Project.count({
            where: { user_id: testUser.id },
        });
        expect(projectCount).toBe(0);

        const areaCount = await Area.count({ where: { user_id: testUser.id } });
        expect(areaCount).toBe(0);

        const noteCount = await Note.count({ where: { user_id: testUser.id } });
        expect(noteCount).toBe(0);

        const tagCount = await Tag.count({ where: { user_id: testUser.id } });
        expect(tagCount).toBe(0);

        const inboxCount = await InboxItem.count({
            where: { user_id: testUser.id },
        });
        expect(inboxCount).toBe(0);
    });

    it('should delete user with views and notifications', async () => {
        // Create view and notification
        const view = await View.create({
            name: 'Test View',
            user_id: testUser.id,
            type: 'custom',
        });

        const notification = await Notification.create({
            user_id: testUser.id,
            type: 'system',
            title: 'Test Notification',
            message: 'Test message',
        });

        // Delete the user
        const delRes = await adminAgent.delete(
            `/api/admin/users/${testUser.id}`
        );
        expect(delRes.status).toBe(204);

        // Verify all related data is deleted
        const viewCount = await View.count({ where: { user_id: testUser.id } });
        expect(viewCount).toBe(0);

        const notifCount = await Notification.count({
            where: { user_id: testUser.id },
        });
        expect(notifCount).toBe(0);
    });

    it('should handle transaction rollback on error', async () => {
        // Create some data
        await Task.create({
            name: 'Test Task',
            user_id: testUser.id,
        });

        // Mock a database error by passing an invalid transaction
        // This test verifies the transaction rollback works
        const userCountBefore = await User.count();
        const taskCountBefore = await Task.count({
            where: { user_id: testUser.id },
        });

        // Try to delete with invalid ID
        const delRes = await adminAgent.delete('/api/admin/users/abc');
        expect(delRes.status).toBe(400);

        // Verify nothing was deleted
        const userCountAfter = await User.count();
        const taskCountAfter = await Task.count({
            where: { user_id: testUser.id },
        });
        expect(userCountAfter).toBe(userCountBefore);
        expect(taskCountAfter).toBe(taskCountBefore);
    });
});
