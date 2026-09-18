const dns = require('dns');
const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { getConfig } = require('../../config/config');

describe('Profile AI settings', () => {
    let agent;
    // Encrypting ai_api_key (see usersService.updateAiSettings /
    // secretCipher) requires key material - TUDUDI_SESSION_SECRET or
    // TUDUDI_OIDC_SECRET_ENCRYPTION_KEY - which isn't guaranteed to be set
    // in every environment this suite runs in (e.g. CI has no .env file).
    // Set it explicitly rather than relying on ambient config.
    const savedSessionSecret = process.env.TUDUDI_SESSION_SECRET;

    beforeEach(async () => {
        process.env.TUDUDI_SESSION_SECRET = 'x'.repeat(64);

        // ai_base_url goes through the SSRF guard (DNS lookup + private-range
        // check, see modules/url/ssrfGuard.js), so tests that set one need a
        // resolvable, non-private address without depending on real DNS.
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
        ]);

        await createTestUser({ email: 'ai-settings@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'ai-settings@example.com',
            password: 'password123',
        });
    });

    afterEach(() => {
        if (savedSessionSecret === undefined) {
            delete process.env.TUDUDI_SESSION_SECRET;
        } else {
            process.env.TUDUDI_SESSION_SECRET = savedSessionSecret;
        }
        jest.restoreAllMocks();
    });

    it('reports nothing set for a fresh user', async () => {
        const response = await agent.get('/api/profile/ai-settings');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            ai_base_url: null,
            ai_model: null,
            ai_api_key_set: false,
            ai_api_key_last4: null,
        });
    });

    it('sets and masks an API key, base URL, and model', async () => {
        const putResponse = await agent.put('/api/profile/ai-settings').send({
            ai_api_key: 'sk-test-secret-key-1234',
            ai_base_url: 'https://api.example.com/v1',
            ai_model: 'llama3.2',
        });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body).toEqual({
            ai_base_url: 'https://api.example.com/v1',
            ai_model: 'llama3.2',
            ai_api_key_set: true,
            ai_api_key_last4: '1234',
        });
        expect(JSON.stringify(putResponse.body)).not.toContain(
            'sk-test-secret-key-1234'
        );

        const getResponse = await agent.get('/api/profile/ai-settings');
        expect(getResponse.body).toEqual(putResponse.body);
    });

    it('leaves the stored key untouched when omitted from the update', async () => {
        await agent.put('/api/profile/ai-settings').send({
            ai_api_key: 'sk-original-0000',
        });

        const response = await agent
            .put('/api/profile/ai-settings')
            .send({ ai_model: 'gpt-4o' });

        expect(response.status).toBe(200);
        expect(response.body.ai_api_key_set).toBe(true);
        expect(response.body.ai_api_key_last4).toBe('0000');
        expect(response.body.ai_model).toBe('gpt-4o');
    });

    it('clears the API key on an explicit empty value', async () => {
        await agent
            .put('/api/profile/ai-settings')
            .send({ ai_api_key: 'sk-to-be-cleared' });

        const response = await agent
            .put('/api/profile/ai-settings')
            .send({ ai_api_key: '' });

        expect(response.status).toBe(200);
        expect(response.body.ai_api_key_set).toBe(false);
        expect(response.body.ai_api_key_last4).toBe(null);
    });

    it('rejects a malformed base URL', async () => {
        const response = await agent
            .put('/api/profile/ai-settings')
            .send({ ai_base_url: 'not-a-url' });

        expect(response.status).toBe(400);
    });

    // SSRF: a user-supplied base URL drives a server-side outbound request
    // (backend/modules/ai-assistant/service.js), so internal/private targets
    // must be rejected the same way modules/url/service.js already rejects
    // them for link-preview fetches.
    it('rejects a base URL that resolves to a private address', async () => {
        dns.promises.lookup.mockResolvedValue([
            { address: '10.0.0.5', family: 4 },
        ]);

        const response = await agent
            .put('/api/profile/ai-settings')
            .send({ ai_base_url: 'https://internal.example.com/v1' });

        expect(response.status).toBe(400);
    });

    it('rejects a base URL that is a private IP literal', async () => {
        const response = await agent
            .put('/api/profile/ai-settings')
            .send({ ai_base_url: 'http://169.254.169.254/latest/meta-data/' });

        expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
        const response = await request(app).get('/api/profile/ai-settings');
        expect(response.status).toBe(401);
    });

    // Hosted subscribers share the operator's own provider (see
    // resolveAIConfig's hosted branch in ai-assistant/service.js) - writing
    // a per-user override must be rejected server-side, not just hidden in
    // the UI.
    it('rejects writes in hosted mode', async () => {
        const config = getConfig();
        config.hosted.enabled = true;
        try {
            const response = await agent
                .put('/api/profile/ai-settings')
                .send({ ai_model: 'gpt-4o' });

            expect(response.status).toBe(403);
        } finally {
            config.hosted.enabled = false;
        }
    });
});
