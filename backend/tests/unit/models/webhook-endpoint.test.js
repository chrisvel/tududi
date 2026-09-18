const bcrypt = require('bcrypt');
const { WebhookEndpoint, User } = require('../../../models');

describe('WebhookEndpoint Model', () => {
    let testUser;

    beforeEach(async () => {
        testUser = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    it('generates a uid and defaults event_types/active', async () => {
        const endpoint = await WebhookEndpoint.create({
            user_id: testUser.id,
            name: 'My endpoint',
            url: 'https://example.com/hook',
            secret: 'shh',
        });

        expect(endpoint.uid).toBeDefined();
        expect(endpoint.event_types).toEqual([]);
        expect(endpoint.active).toBe(true);
        expect(endpoint.failure_count).toBe(0);
    });

    it('rejects a non-http(s) url', async () => {
        await expect(
            WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Bad endpoint',
                url: 'not-a-url',
                secret: 'shh',
            })
        ).rejects.toThrow();
    });

    describe('matchesType', () => {
        it('matches any type when event_types is empty', async () => {
            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'All events',
                url: 'https://example.com/hook',
                secret: 'shh',
                event_types: [],
            });

            expect(endpoint.matchesType('task_due_soon')).toBe(true);
            expect(endpoint.matchesType('project_overdue')).toBe(true);
        });

        it('only matches subscribed types when event_types is set', async () => {
            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Due tasks only',
                url: 'https://example.com/hook',
                secret: 'shh',
                event_types: ['task_due_soon'],
            });

            expect(endpoint.matchesType('task_due_soon')).toBe(true);
            expect(endpoint.matchesType('task_overdue')).toBe(false);
        });
    });
});
