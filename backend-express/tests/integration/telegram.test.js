const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Mock the TelegramPoller service
jest.mock('../../services/telegramPoller', () => ({
  getInstance: jest.fn().mockReturnValue({
    addUser: jest.fn().mockResolvedValue(true),
    removeUser: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({
      isRunning: true,
      userCount: 1,
      pollInterval: 5000
    })
  })
}));

describe('Telegram Routes', () => {
  let user, agent;

  beforeEach(async () => {
    user = await createTestUser({
      email: 'test@example.com'
    });

    // Create authenticated agent
    agent = request.agent(app);
    await agent
      .post('/api/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
  });

  describe('POST /api/telegram/setup', () => {
    it('should setup telegram bot token', async () => {
      const botToken = '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890';
      
      const response = await agent
        .post('/api/telegram/setup')
        .send({ token: botToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Telegram bot token configured successfully');

      // Verify token was saved to user
      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser.telegram_bot_token).toBe(botToken);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/telegram/setup')
        .send({ token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should require token parameter', async () => {
      const response = await agent
        .post('/api/telegram/setup')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bot token is required');
    });

    it('should validate token format', async () => {
      const response = await agent
        .post('/api/telegram/setup')
        .send({ token: 'invalid-token-format' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid bot token format');
    });

    it('should validate token format with correct pattern', async () => {
      // Test various invalid formats
      const invalidTokens = [
        '123456:short',
        'notnum:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890',
        '123456789-ABCdefGHIjklMNOPQRSTUVwxyz-1234567890',
        '123456789:',
        ':ABCdefGHIjklMNOPQRSTUVwxyz-1234567890'
      ];

      for (const token of invalidTokens) {
        const response = await agent
          .post('/api/telegram/setup')
          .send({ token });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid bot token format');
      }
    });

    it('should accept valid token formats', async () => {
      const validTokens = [
        '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890',
        '987654321:XYZabcDEFghiJKLmnoPQRstUVW_0987654321',
        '555555555:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ];

      for (const token of validTokens) {
        const response = await agent
          .post('/api/telegram/setup')
          .send({ token });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Telegram bot token configured successfully');
      }
    });
  });

  describe('POST /api/telegram/start-polling', () => {
    beforeEach(async () => {
      // Setup bot token first
      await user.update({
        telegram_bot_token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890'
      });
    });

    it('should start telegram polling', async () => {
      const response = await agent
        .post('/api/telegram/start-polling');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Telegram polling started successfully');
      expect(response.body.status).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/telegram/start-polling');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should require bot token to be configured', async () => {
      // Remove bot token
      await user.update({ telegram_bot_token: null });

      const response = await agent
        .post('/api/telegram/start-polling');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Telegram bot token not configured. Please configure your bot token first.');
    });

    it('should return current status when polling started', async () => {
      const response = await agent
        .post('/api/telegram/start-polling');

      expect(response.status).toBe(200);
      expect(response.body.status).toEqual({
        isRunning: true,
        userCount: 1,
        pollInterval: 5000
      });
    });
  });

  describe('POST /api/telegram/stop-polling', () => {
    beforeEach(async () => {
      // Setup bot token first
      await user.update({
        telegram_bot_token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-1234567890'
      });
    });

    it('should stop telegram polling', async () => {
      const response = await agent
        .post('/api/telegram/stop-polling');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Telegram polling stopped successfully');
      expect(response.body.status).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/telegram/stop-polling');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return current status when polling stopped', async () => {
      const response = await agent
        .post('/api/telegram/stop-polling');

      expect(response.status).toBe(200);
      expect(response.body.status).toEqual({
        isRunning: true,
        userCount: 1,
        pollInterval: 5000
      });
    });
  });

  describe('GET /api/telegram/polling-status', () => {
    it('should get polling status', async () => {
      const response = await agent
        .get('/api/telegram/polling-status');

      expect(response.status).toBe(200);
      expect(response.body.status).toEqual({
        isRunning: true,
        userCount: 1,
        pollInterval: 5000
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/telegram/polling-status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return status object with expected properties', async () => {
      const response = await agent
        .get('/api/telegram/polling-status');

      expect(response.status).toBe(200);
      expect(response.body.status).toHaveProperty('isRunning');
      expect(response.body.status).toHaveProperty('userCount');
      expect(response.body.status).toHaveProperty('pollInterval');
      expect(typeof response.body.status.isRunning).toBe('boolean');
      expect(typeof response.body.status.userCount).toBe('number');
      expect(typeof response.body.status.pollInterval).toBe('number');
    });
  });
});