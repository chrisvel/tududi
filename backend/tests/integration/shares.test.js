const request = require('supertest');
const app = require('../../app');
const { Project, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { sendEmail } = require('../../services/emailService');

jest.mock('../../services/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
    }),
    isEmailEnabled: jest.fn().mockReturnValue(true),
}));

describe('Shares Routes - Authentication', () => {
    describe('POST /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).post('/api/shares').send({
                resource_type: 'project',
                resource_uid: 'uid',
                target_user_email: 'x@y.com',
                access_level: 'ro',
            });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: 'uid',
                target_user_id: 1,
            });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).get(
                '/api/shares?resource_type=project&resource_uid=uid'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});

describe('Shares Routes - Email Notifications', () => {
    let owner, targetUser, project, agent;

    beforeEach(async () => {
        jest.clearAllMocks();

        owner = await createTestUser({
            email: 'owner@example.com',
        });

        targetUser = await createTestUser({
            email: 'target@example.com',
        });

        project = await Project.create({
            name: 'Test Project',
            description: 'A test project for sharing',
            user_id: owner.id,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'owner@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/shares - Grant Share', () => {
        it('should send email notification when sharing a project', async () => {
            const response = await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: 'target@example.com',
                access_level: 'rw',
            });

            expect(response.status).toBe(204);
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'target@example.com',
                    subject: expect.stringContaining('Shared with you'),
                    subject: expect.stringContaining('Test Project'),
                })
            );

            const emailCall = sendEmail.mock.calls[0][0];
            expect(emailCall.text).toContain('owner@example.com');
            expect(emailCall.text).toContain('Test Project');
            expect(emailCall.text).toContain('rw');
            expect(emailCall.html).toContain('owner@example.com');
            expect(emailCall.html).toContain('Test Project');
        });

        it('should include project description in email', async () => {
            const response = await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: 'target@example.com',
                access_level: 'ro',
            });

            expect(response.status).toBe(204);
            const emailCall = sendEmail.mock.calls[0][0];
            expect(emailCall.text).toContain('A test project for sharing');
            expect(emailCall.html).toContain('A test project for sharing');
        });

        it('should still share successfully even if email fails', async () => {
            sendEmail.mockRejectedValueOnce(new Error('SMTP error'));

            const response = await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: 'target@example.com',
                access_level: 'rw',
            });

            expect(response.status).toBe(204);
            expect(sendEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe('DELETE /api/shares - Revoke Share', () => {
        beforeEach(async () => {
            await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: 'target@example.com',
                access_level: 'rw',
            });
            jest.clearAllMocks();
        });

        it('should send email notification when revoking share', async () => {
            const response = await agent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: targetUser.id,
            });

            expect(response.status).toBe(204);
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'target@example.com',
                    subject: expect.stringContaining('Access removed'),
                    subject: expect.stringContaining('Test Project'),
                })
            );

            const emailCall = sendEmail.mock.calls[0][0];
            expect(emailCall.text).toContain('owner@example.com');
            expect(emailCall.text).toContain('removed your access');
            expect(emailCall.text).toContain('Test Project');
            expect(emailCall.html).toContain('removed your access');
        });

        it('should still revoke successfully even if email fails', async () => {
            sendEmail.mockRejectedValueOnce(new Error('SMTP error'));

            const response = await agent.delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_id: targetUser.id,
            });

            expect(response.status).toBe(204);
            expect(sendEmail).toHaveBeenCalledTimes(1);
        });
    });
});
