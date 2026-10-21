const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { getConfig } = require('../../config/config');
const { createTestUser } = require('../helpers/testUtils');
const {
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const {
    isTelegramConfigured,
} = require('../../modules/telegram/telegramNotificationService');

describe('TELEGRAM_ENABLED=false', () => {
    let user, agent;

    beforeEach(async () => {
        getConfig().telegramEnabled = false;
        user = await createTestUser({ email: 'test@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    afterEach(() => {
        getConfig().telegramEnabled = true;
    });

    it('reports the telegram feature flag as off', async () => {
        const response = await agent.get('/api/feature-flags');
        expect(response.status).toBe(200);
        expect(response.body.featureFlags.telegram).toBe(false);
    });

    it('answers 404 on the telegram API', async () => {
        const setup = await agent
            .post('/api/telegram/setup')
            .send({ token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-12345678' });
        expect(setup.status).toBe(404);

        const status = await agent.get('/api/telegram/polling-status');
        expect(status.status).toBe(404);
    });

    it('keeps the stored token when the profile form saves', async () => {
        await user.update({ telegram_bot_token: '1:stored' });

        const response = await agent
            .patch('/api/profile')
            .send({ telegram_bot_token: '' });
        expect(response.status).toBe(200);

        const reloaded = await User.findByPk(user.id);
        expect(reloaded.telegram_bot_token).toBe('1:stored');
    });

    it('never picks telegram as a delivery channel', () => {
        const telegramUser = {
            telegram_bot_token: '1:abc',
            telegram_chat_id: '42',
            notification_preferences: { dueTasks: { telegram: true } },
        };
        expect(shouldSendTelegramNotification(telegramUser, 'dueTasks')).toBe(
            false
        );
        expect(isTelegramConfigured(telegramUser)).toBe(false);
    });
});
