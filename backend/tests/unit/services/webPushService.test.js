// Set VAPID keys before requiring the service so it initializes as configured
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const webpush = require('web-push');

// Mock web-push module
jest.mock('web-push');

// Mock PushSubscription model
jest.mock('../../../models', () => ({
    PushSubscription: {
        findOrCreate: jest.fn(),
        destroy: jest.fn(),
        findAll: jest.fn(),
    },
}));

// Mock logService
jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

// Import after mocks are set up
const { PushSubscription } = require('../../../models');
const webPushService = require('../../../services/webPushService');

describe('webPushService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isWebPushConfigured', () => {
        it('should return boolean based on VAPID configuration', () => {
            const result = webPushService.isWebPushConfigured();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('getVapidPublicKey', () => {
        it('should return the VAPID public key or null', () => {
            const result = webPushService.getVapidPublicKey();
            expect(result === null || typeof result === 'string').toBe(true);
        });
    });

    describe('subscribe', () => {
        it('should create new subscription', async () => {
            const userId = 1;
            const subscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/test123',
                keys: {
                    p256dh: 'test_p256dh_key',
                    auth: 'test_auth_key',
                },
            };

            const mockSubscription = {
                id: 1,
                user_id: userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
            };

            PushSubscription.findOrCreate.mockResolvedValue([
                mockSubscription,
                true,
            ]);

            const result = await webPushService.subscribe(userId, subscription);

            expect(result.success).toBe(true);
            expect(result.created).toBe(true);
            expect(PushSubscription.findOrCreate).toHaveBeenCalledWith({
                where: { endpoint: subscription.endpoint },
                defaults: {
                    user_id: userId,
                    keys: subscription.keys,
                },
            });
        });

        it('should update existing subscription', async () => {
            const userId = 1;
            const subscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/test123',
                keys: {
                    p256dh: 'new_key',
                    auth: 'new_auth',
                },
            };

            const mockSubscription = {
                id: 1,
                user_id: userId,
                endpoint: subscription.endpoint,
                keys: { p256dh: 'old_key', auth: 'old_auth' },
                update: jest.fn().mockResolvedValue(true),
            };

            PushSubscription.findOrCreate.mockResolvedValue([
                mockSubscription,
                false,
            ]);

            const result = await webPushService.subscribe(userId, subscription);

            expect(result.success).toBe(true);
            expect(result.created).toBe(false);
            expect(mockSubscription.update).toHaveBeenCalledWith({
                user_id: userId,
                keys: subscription.keys,
            });
        });

        it('should handle errors gracefully', async () => {
            const userId = 1;
            const subscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/test123',
                keys: { p256dh: 'key', auth: 'auth' },
            };

            PushSubscription.findOrCreate.mockRejectedValue(
                new Error('Database error')
            );

            const result = await webPushService.subscribe(userId, subscription);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('unsubscribe', () => {
        it('should remove subscription', async () => {
            const userId = 1;
            const endpoint = 'https://fcm.googleapis.com/fcm/send/test123';

            PushSubscription.destroy.mockResolvedValue(1);

            const result = await webPushService.unsubscribe(userId, endpoint);

            expect(result.success).toBe(true);
            expect(result.deleted).toBe(true);
            expect(PushSubscription.destroy).toHaveBeenCalledWith({
                where: { user_id: userId, endpoint },
            });
        });

        it('should return deleted false when subscription not found', async () => {
            const userId = 1;
            const endpoint = 'https://fcm.googleapis.com/fcm/send/test123';

            PushSubscription.destroy.mockResolvedValue(0);

            const result = await webPushService.unsubscribe(userId, endpoint);

            expect(result.success).toBe(true);
            expect(result.deleted).toBe(false);
        });
    });

    describe('sendPushNotification', () => {
        it('should send to all user subscriptions', async () => {
            const userId = 1;
            const notification = {
                title: 'Test Notification',
                message: 'This is a test',
                data: { taskId: 123 },
                type: 'task_due_soon',
            };

            const mockSubscriptions = [
                {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/sub1',
                    keys: { p256dh: 'key1', auth: 'auth1' },
                },
                {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/sub2',
                    keys: { p256dh: 'key2', auth: 'auth2' },
                },
            ];

            PushSubscription.findAll.mockResolvedValue(mockSubscriptions);
            webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

            const result = await webPushService.sendPushNotification(
                userId,
                notification
            );

            expect(result.success).toBe(true);
            expect(result.sent).toBe(2);
            expect(result.total).toBe(2);
            expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
        });

        it('should remove invalid subscriptions (410 Gone)', async () => {
            const userId = 1;
            const notification = { title: 'Test', message: 'Test' };

            const expiredSubscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/expired',
                keys: { p256dh: 'key', auth: 'auth' },
                destroy: jest.fn().mockResolvedValue(true),
            };

            PushSubscription.findAll.mockResolvedValue([expiredSubscription]);

            const error = new Error('Subscription has expired');
            error.statusCode = 410;
            webpush.sendNotification.mockRejectedValue(error);

            const result = await webPushService.sendPushNotification(
                userId,
                notification
            );

            // Promise.allSettled catches all rejections, so success is still true
            // but sent count is 0 because the notification failed
            expect(result.success).toBe(true);
            expect(result.sent).toBe(0);
            expect(result.total).toBe(1);

            // Wait a bit for async destroy to complete
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(expiredSubscription.destroy).toHaveBeenCalled();
        });

        it('should remove invalid subscriptions (404 Not Found)', async () => {
            const userId = 1;
            const notification = { title: 'Test', message: 'Test' };

            const notFoundSubscription = {
                endpoint: 'https://fcm.googleapis.com/fcm/send/notfound',
                keys: { p256dh: 'key', auth: 'auth' },
                destroy: jest.fn().mockResolvedValue(true),
            };

            PushSubscription.findAll.mockResolvedValue([notFoundSubscription]);

            const error = new Error('Subscription not found');
            error.statusCode = 404;
            webpush.sendNotification.mockRejectedValue(error);

            const result = await webPushService.sendPushNotification(
                userId,
                notification
            );

            expect(result.success).toBe(true);
            expect(result.sent).toBe(0);
            expect(result.total).toBe(1);
            expect(notFoundSubscription.destroy).toHaveBeenCalled();
        });

        it('should handle partial failures', async () => {
            const userId = 1;
            const notification = { title: 'Test', message: 'Test' };

            const mockSubscriptions = [
                {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/sub1',
                    keys: { p256dh: 'key1', auth: 'auth1' },
                    destroy: jest.fn(),
                },
                {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/sub2',
                    keys: { p256dh: 'key2', auth: 'auth2' },
                    destroy: jest.fn(),
                },
            ];

            PushSubscription.findAll.mockResolvedValue(mockSubscriptions);

            // First succeeds, second fails with non-410/404 error
            webpush.sendNotification
                .mockResolvedValueOnce({ statusCode: 201 })
                .mockRejectedValueOnce(new Error('Network error'));

            const result = await webPushService.sendPushNotification(
                userId,
                notification
            );

            expect(result.success).toBe(true);
            expect(result.sent).toBe(1);
            expect(result.total).toBe(2);
            expect(mockSubscriptions[1].destroy).not.toHaveBeenCalled(); // Non-410/404 error, don't delete
        });

        it('should return error when not configured', () => {
            // Create a fresh instance of the service with no VAPID keys
            // Temporarily clear env vars
            const originalVapidPublic = process.env.VAPID_PUBLIC_KEY;
            const originalVapidPrivate = process.env.VAPID_PRIVATE_KEY;

            delete process.env.VAPID_PUBLIC_KEY;
            delete process.env.VAPID_PRIVATE_KEY;

            // Need to clear the module cache and re-require to pick up new env vars
            jest.resetModules();
            const unconfiguredService = require('../../../services/webPushService');

            const userId = 1;
            const notification = { title: 'Test', message: 'Test' };

            // Test that service is unconfigured
            expect(unconfiguredService.isWebPushConfigured()).toBe(false);

            // Test the error response
            const result = unconfiguredService.sendPushNotification(
                userId,
                notification
            );

            // Restore env vars
            process.env.VAPID_PUBLIC_KEY = originalVapidPublic;
            process.env.VAPID_PRIVATE_KEY = originalVapidPrivate;

            // Return the promise so Jest waits for it
            return result.then((res) => {
                expect(res.success).toBe(false);
                expect(res.error).toContain('not configured');
            });
        });
    });
});
