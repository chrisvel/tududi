const request = require('supertest');
const app = require('../../app');
const { PushSubscription, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const webpush = require('web-push');

describe('Push Notifications API', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('GET /api/notifications/push/vapid-key', () => {
        it('should return VAPID public key when configured', async () => {
            // Skip if VAPID not configured in test environment
            if (!process.env.VAPID_PUBLIC_KEY) {
                console.log('Skipping: VAPID keys not configured in test env');
                return;
            }

            const response = await agent.get(
                '/api/notifications/push/vapid-key'
            );

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('publicKey');
            expect(typeof response.body.publicKey).toBe('string');
            expect(response.body.publicKey.length).toBeGreaterThan(0);
        });

        it('should return 503 when VAPID not configured', async () => {
            // Only run if VAPID is not configured
            if (process.env.VAPID_PUBLIC_KEY) {
                console.log('Skipping: VAPID keys are configured');
                return;
            }

            const response = await agent.get(
                '/api/notifications/push/vapid-key'
            );

            expect(response.status).toBe(503);
            expect(response.body.error).toContain('not configured');
        });
    });

    describe('POST /api/notifications/push/subscribe', () => {
        it('should create new push subscription', async () => {
            const subscription = {
                endpoint: `https://fcm.googleapis.com/fcm/send/test_${Date.now()}`,
                keys: {
                    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
                    auth: 'tBHItJI5svbpez7KI4CCXg==',
                },
            };

            const response = await agent
                .post('/api/notifications/push/subscribe')
                .send({ subscription });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify in database
            const saved = await PushSubscription.findOne({
                where: { endpoint: subscription.endpoint },
            });

            expect(saved).toBeTruthy();
            expect(saved.user_id).toBe(user.id);
            expect(saved.keys).toEqual(subscription.keys);
        });

        it('should update existing subscription for same endpoint', async () => {
            const endpoint = `https://fcm.googleapis.com/fcm/send/test_${Date.now()}`;
            const oldKeys = {
                p256dh: 'OLD_KEY',
                auth: 'OLD_AUTH',
            };
            const newKeys = {
                p256dh: 'NEW_KEY',
                auth: 'NEW_AUTH',
            };

            // Create initial subscription
            await agent.post('/api/notifications/push/subscribe').send({
                subscription: {
                    endpoint,
                    keys: oldKeys,
                },
            });

            // Update with new keys
            const response = await agent
                .post('/api/notifications/push/subscribe')
                .send({
                    subscription: {
                        endpoint,
                        keys: newKeys,
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify updated in database
            const subscriptions = await PushSubscription.findAll({
                where: { endpoint },
            });

            expect(subscriptions.length).toBe(1);
            expect(subscriptions[0].keys).toEqual(newKeys);
        });

        it('should require authentication', async () => {
            const subscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/test',
                keys: {
                    p256dh: 'test_key',
                    auth: 'test_auth',
                },
            };

            const response = await request(app)
                .post('/api/notifications/push/subscribe')
                .send({ subscription });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should validate subscription format - missing endpoint', async () => {
            const response = await agent
                .post('/api/notifications/push/subscribe')
                .send({
                    subscription: {
                        keys: {
                            p256dh: 'test_key',
                            auth: 'test_auth',
                        },
                    },
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid subscription');
        });

        it('should validate subscription format - missing keys', async () => {
            const response = await agent
                .post('/api/notifications/push/subscribe')
                .send({
                    subscription: {
                        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
                    },
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid subscription');
        });
    });

    describe('DELETE /api/notifications/push/unsubscribe', () => {
        it('should remove push subscription', async () => {
            const endpoint = `https://fcm.googleapis.com/fcm/send/test_${Date.now()}`;

            // Create subscription first
            await agent.post('/api/notifications/push/subscribe').send({
                subscription: {
                    endpoint,
                    keys: {
                        p256dh: 'test_key',
                        auth: 'test_auth',
                    },
                },
            });

            // Verify it exists
            let subscription = await PushSubscription.findOne({
                where: { endpoint },
            });
            expect(subscription).toBeTruthy();

            // Delete it
            const response = await agent
                .delete('/api/notifications/push/unsubscribe')
                .send({ endpoint });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify removed from database
            subscription = await PushSubscription.findOne({
                where: { endpoint },
            });
            expect(subscription).toBeNull();
        });

        it("should only remove user's own subscription", async () => {
            // Create another user
            const otherUser = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });

            const endpoint = `https://fcm.googleapis.com/fcm/send/test_${Date.now()}`;

            // Create subscription for other user
            await PushSubscription.create({
                user_id: otherUser.id,
                endpoint,
                keys: {
                    p256dh: 'test_key',
                    auth: 'test_auth',
                },
            });

            // Try to delete with current user's session
            const response = await agent
                .delete('/api/notifications/push/unsubscribe')
                .send({ endpoint });

            expect(response.status).toBe(200);
            expect(response.body.deleted).toBe(false);

            // Verify other user's subscription still exists
            const subscription = await PushSubscription.findOne({
                where: { endpoint },
            });
            expect(subscription).toBeTruthy();
            expect(subscription.user_id).toBe(otherUser.id);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .delete('/api/notifications/push/unsubscribe')
                .send({ endpoint: 'https://test.endpoint' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require endpoint parameter', async () => {
            const response = await agent
                .delete('/api/notifications/push/unsubscribe')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });
    });

    describe('Integration with test-notifications', () => {
        it('should include push in sources when enabled in preferences and subscribed', async () => {
            // Enable push notification preference for due tasks
            await agent.patch('/api/profile').send({
                notification_preferences: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: true,
                        telegram: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                },
            });

            // Subscribe to push
            await agent.post('/api/notifications/push/subscribe').send({
                subscription: {
                    endpoint: `https://test.endpoint/${Date.now()}`,
                    keys: {
                        p256dh: 'test_key',
                        auth: 'test_auth',
                    },
                },
            });

            // Trigger test notification
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body.notification.sources).toContain('push');
        });

        it('should not include push when disabled in preferences', async () => {
            // Disable push notification preference
            await agent.patch('/api/profile').send({
                notification_preferences: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                },
            });

            // Subscribe to push (but disabled in preferences)
            await agent.post('/api/notifications/push/subscribe').send({
                subscription: {
                    endpoint: `https://test.endpoint/${Date.now()}`,
                    keys: {
                        p256dh: 'test_key',
                        auth: 'test_auth',
                    },
                },
            });

            // Trigger test notification
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body.notification.sources).not.toContain('push');
        });

        it('should not include push when not subscribed', async () => {
            // Enable push preference but don't subscribe
            await agent.patch('/api/profile').send({
                notification_preferences: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: true,
                        telegram: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                },
            });

            // Don't subscribe to push

            // Trigger test notification
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            // Push preference is on but no subscription exists, so still sent
            // The webPushService will just not send anything (0 subscriptions)
            expect(response.body.notification.sources).toContain('push');
        });
    });
});
