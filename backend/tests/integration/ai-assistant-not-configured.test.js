const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('AI Assistant - missing LLM configuration', () => {
    let agent;
    const savedEnv = {};

    beforeEach(async () => {
        savedEnv.llmKey = process.env.LLM_API_KEY;
        savedEnv.openaiKey = process.env.OPENAI_API_KEY;
        delete process.env.LLM_API_KEY;
        delete process.env.OPENAI_API_KEY;

        await createTestUser({ email: 'ai-config@example.com' });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'ai-config@example.com',
            password: 'password123',
        });
    });

    afterEach(() => {
        if (savedEnv.llmKey === undefined) {
            delete process.env.LLM_API_KEY;
        } else {
            process.env.LLM_API_KEY = savedEnv.llmKey;
        }
        if (savedEnv.openaiKey === undefined) {
            delete process.env.OPENAI_API_KEY;
        } else {
            process.env.OPENAI_API_KEY = savedEnv.openaiKey;
        }
    });

    it('reports api_key_set false from the config endpoint', async () => {
        const response = await agent.get('/api/ai-assistant/config');

        expect(response.status).toBe(200);
        expect(response.body.api_key_set).toBe(false);
    });

    it('returns 503 AI_NOT_CONFIGURED for the daily brief', async () => {
        const response = await agent.post('/api/ai-assistant/daily-brief');

        expect(response.status).toBe(503);
        expect(response.body.code).toBe('AI_NOT_CONFIGURED');
        expect(response.body.error).toMatch(/LLM_API_KEY/);
    });

    it('returns 503 AI_NOT_CONFIGURED for task insights', async () => {
        const response = await agent
            .post('/api/ai-assistant/task-insights')
            .send({ taskName: 'Write the report' });

        expect(response.status).toBe(503);
        expect(response.body.code).toBe('AI_NOT_CONFIGURED');
    });

    it('returns 503 AI_NOT_CONFIGURED for project insights', async () => {
        const response = await agent
            .post('/api/ai-assistant/project-insights')
            .send({ projectName: 'Website redesign' });

        expect(response.status).toBe(503);
        expect(response.body.code).toBe('AI_NOT_CONFIGURED');
    });

    it('keeps the actionable message in production mode', async () => {
        const savedNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            // CSRF protection is only enforced outside the test environment
            const { body } = await agent.get('/api/csrf-token');
            const response = await agent
                .post('/api/ai-assistant/daily-brief')
                .set('x-csrf-token', body.csrfToken);

            expect(response.status).toBe(503);
            expect(response.body.code).toBe('AI_NOT_CONFIGURED');
            expect(response.body.error).not.toBe('Internal server error');
        } finally {
            process.env.NODE_ENV = savedNodeEnv;
        }
    });

    it('accepts a configured key again', async () => {
        process.env.LLM_API_KEY = 'test-key';

        const response = await agent.get('/api/ai-assistant/config');

        expect(response.status).toBe(200);
        expect(response.body.api_key_set).toBe(true);
    });
});
