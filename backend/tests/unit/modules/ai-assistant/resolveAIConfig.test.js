const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');
const secretCipher = require('../../../../shared/crypto/secretCipher');
const { getConfig } = require('../../../../config/config');

describe('AI Assistant - resolveAIConfig precedence', () => {
    const savedEnv = {};
    const ENV_KEYS = [
        'LLM_API_KEY',
        'OPENAI_API_KEY',
        'LLM_BASE_URL',
        'OPENAI_BASE_URL',
        'LLM_MODEL',
        'TUDUDI_AI_MODEL',
        'TUDUDI_SESSION_SECRET',
        'TUDUDI_OIDC_SECRET_ENCRYPTION_KEY',
    ];

    beforeEach(() => {
        ENV_KEYS.forEach((key) => {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        });
        process.env.LLM_API_KEY = 'env-key';
        process.env.LLM_BASE_URL = 'https://env.example.com/v1';
        process.env.LLM_MODEL = 'env-model';
        // Needed to encrypt a fake stored key below, independent of whatever
        // (or nothing) this machine's real .env happens to have.
        process.env.TUDUDI_SESSION_SECRET = 'x'.repeat(64);
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (savedEnv[key] === undefined) delete process.env[key];
            else process.env[key] = savedEnv[key];
        });
    });

    it('falls back to env values when the user has none of their own', async () => {
        const user = await createTestUser({ email: 'resolve-env@example.com' });

        const resolved = await aiAssistantService.resolveAIConfig(user.id);

        expect(resolved).toEqual({
            apiKey: 'env-key',
            apiKeySource: 'env',
            baseURL: 'https://env.example.com/v1',
            baseUrlSource: 'env',
            model: 'env-model',
            modelSource: 'env',
        });
    });

    it("prefers the user's own DB values field by field", async () => {
        const user = await createTestUser({
            email: 'resolve-db@example.com',
            ai_api_key: secretCipher.encrypt('user-key'),
            ai_model: 'user-model',
        });

        const resolved = await aiAssistantService.resolveAIConfig(user.id);

        expect(resolved.apiKey).toBe('user-key');
        expect(resolved.apiKeySource).toBe('user');
        expect(resolved.model).toBe('user-model');
        expect(resolved.modelSource).toBe('user');
        // ai_base_url was left unset for this user, so it still falls back.
        expect(resolved.baseURL).toBe('https://env.example.com/v1');
        expect(resolved.baseUrlSource).toBe('env');
    });

    it('resolves to defaults only with no user context and no env vars', async () => {
        delete process.env.LLM_API_KEY;
        delete process.env.LLM_BASE_URL;
        delete process.env.LLM_MODEL;

        const resolved = await aiAssistantService.resolveAIConfig(null);

        expect(resolved).toEqual({
            apiKey: null,
            apiKeySource: null,
            baseURL: null,
            baseUrlSource: null,
            model: 'gpt-4o-mini',
            modelSource: 'default',
        });
    });

    describe('hosted mode', () => {
        const config = getConfig();

        afterEach(() => {
            config.hosted.enabled = false;
        });

        it('ignores a per-user DB override and always uses the .env provider', async () => {
            const user = await createTestUser({
                email: 'resolve-hosted@example.com',
                ai_api_key: secretCipher.encrypt('user-key'),
                ai_base_url: 'https://user.example.com/v1',
                ai_model: 'user-model',
            });
            config.hosted.enabled = true;

            const resolved = await aiAssistantService.resolveAIConfig(user.id);

            expect(resolved).toEqual({
                apiKey: 'env-key',
                apiKeySource: 'env',
                baseURL: 'https://env.example.com/v1',
                baseUrlSource: 'env',
                model: 'env-model',
                modelSource: 'env',
            });
        });
    });
});
