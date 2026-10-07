const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { getConfig } = require('../../config/config');

// The instance's own base_url/model describe the operator's server config,
// not the caller's -- on a hosted instance the caller isn't the operator,
// so those fields must not reach them (see modules/ai-assistant/controller.js).
describe('AI Assistant config - hosted mode', () => {
    let agent;
    const savedEnv = {};
    let wasHosted;

    beforeEach(async () => {
        savedEnv.llmKey = process.env.LLM_API_KEY;
        savedEnv.openaiKey = process.env.OPENAI_API_KEY;
        savedEnv.baseUrl = process.env.LLM_BASE_URL;
        savedEnv.model = process.env.LLM_MODEL;
        process.env.LLM_API_KEY = 'test-key';
        delete process.env.OPENAI_API_KEY;
        process.env.LLM_BASE_URL = 'https://internal-llm.example.net';
        process.env.LLM_MODEL = 'gpt-4o-mini';

        wasHosted = getConfig().hosted.enabled;
        getConfig().hosted.enabled = true;

        await createTestUser({ email: 'ai-hosted@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'ai-hosted@example.com',
            password: 'password123',
        });
    });

    afterEach(() => {
        getConfig().hosted.enabled = wasHosted;

        if (savedEnv.llmKey === undefined) delete process.env.LLM_API_KEY;
        else process.env.LLM_API_KEY = savedEnv.llmKey;
        if (savedEnv.openaiKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = savedEnv.openaiKey;
        if (savedEnv.baseUrl === undefined) delete process.env.LLM_BASE_URL;
        else process.env.LLM_BASE_URL = savedEnv.baseUrl;
        if (savedEnv.model === undefined) delete process.env.LLM_MODEL;
        else process.env.LLM_MODEL = savedEnv.model;
    });

    it('omits base_url and model, keeping only api_key_set', async () => {
        const response = await agent.get('/api/ai-assistant/config');

        expect(response.status).toBe(200);
        expect(response.body.api_key_set).toBe(true);
        expect(response.body.base_url).toBeUndefined();
        expect(response.body.model).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain(
            'internal-llm.example.net'
        );
    });

    it('still reports api_key_set false when unconfigured', async () => {
        delete process.env.LLM_API_KEY;
        delete process.env.OPENAI_API_KEY;

        const response = await agent.get('/api/ai-assistant/config');

        expect(response.status).toBe(200);
        expect(response.body.api_key_set).toBe(false);
    });
});
