const { Project, Notification, User } = require('../../../../models');
const {
    checkDueProjects,
} = require('../../../../modules/projects/dueProjectService');
const bcrypt = require('bcrypt');

describe('dueProjectService', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
            notification_preferences: {
                inApp: {
                    project_due_soon: true,
                    project_overdue: true,
                },
            },
        });
    });

    describe('checkDueProjects', () => {
        it('should create an overdue notification for an active overdue project', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const project = await Project.create({
                name: 'Active Project',
                user_id: user.id,
                due_date_at: yesterday,
                status: 'in_progress',
            });

            await checkDueProjects();

            const notifications = await Notification.findAll({
                where: { user_id: user.id, type: 'project_overdue' },
            });

            expect(notifications.length).toBe(1);
            expect(notifications[0].data.projectUid).toBe(project.uid);
        });

        it('should not create a notification for a project marked done', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await Project.create({
                name: 'Completed Project',
                user_id: user.id,
                due_date_at: yesterday,
                status: 'done',
            });

            await checkDueProjects();

            const notifications = await Notification.findAll({
                where: { user_id: user.id },
            });

            expect(notifications.length).toBe(0);
        });

        it('should not create a notification for a cancelled project', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await Project.create({
                name: 'Cancelled Project',
                user_id: user.id,
                due_date_at: yesterday,
                status: 'cancelled',
            });

            await checkDueProjects();

            const notifications = await Notification.findAll({
                where: { user_id: user.id },
            });

            expect(notifications.length).toBe(0);
        });
    });
});
