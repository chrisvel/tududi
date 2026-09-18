const dns = require('dns');
const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');
const secretCipher = require('../../../../shared/crypto/secretCipher');

// A user-configured ai_base_url drives a server-side outbound request
// (getOpenAIClient in modules/ai-assistant/service.js), so it must be
// re-validated the same way modules/url/service.js validates user-supplied
// URLs before fetching them - otherwise any account could point the server
// at internal infrastructure (cloud metadata, other services on the host).
describe('AI Assistant - SSRF guard on user-configured base URL', () => {
    const savedEnv = {};
    const ENV_KEYS = [
        'LLM_API_KEY',
        'OPENAI_API_KEY',
        'LLM_BASE_URL',
        'OPENAI_BASE_URL',
        'TUDUDI_SESSION_SECRET',
    ];

    beforeEach(() => {
        ENV_KEYS.forEach((key) => {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        });
        process.env.TUDUDI_SESSION_SECRET = 'x'.repeat(64);

        mockCreate.mockReset();
        OpenAI.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (savedEnv[key] === undefined) delete process.env[key];
            else process.env[key] = savedEnv[key];
        });
        jest.restoreAllMocks();
    });

    it('refuses to call out to a user-configured base URL that resolves to a private address', async () => {
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '169.254.169.254', family: 4 },
        ]);
        const user = await createTestUser({
            email: 'ssrf-client@example.com',
            ai_api_key: secretCipher.encrypt('user-key'),
            ai_base_url: 'https://internal.example.com/v1',
        });

        await expect(
            aiAssistantService.generateProjectInsights(
                { projectName: 'Website redesign' },
                user.id
            )
        ).rejects.toMatchObject({ code: 'AI_BASE_URL_UNSAFE' });

        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects a user-configured private IP literal outright, with no DNS lookup', async () => {
        const lookupSpy = jest.spyOn(dns.promises, 'lookup');
        const user = await createTestUser({
            email: 'ssrf-client-ip@example.com',
            ai_api_key: secretCipher.encrypt('user-key'),
            ai_base_url: 'http://169.254.169.254/latest/meta-data/',
        });

        await expect(
            aiAssistantService.generateProjectInsights(
                { projectName: 'Website redesign' },
                user.id
            )
        ).rejects.toMatchObject({ code: 'AI_BASE_URL_UNSAFE' });

        expect(mockCreate).not.toHaveBeenCalled();
        expect(lookupSpy).not.toHaveBeenCalled();
    });

    it('still allows an operator-configured .env base URL pointing at localhost', async () => {
        process.env.LLM_API_KEY = 'env-key';
        process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
            model: 'test-model',
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(OpenAI).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'http://localhost:11434/v1' })
        );
    });
});
