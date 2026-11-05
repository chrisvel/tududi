const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');

function systemPrompt() {
    const params = mockCreate.mock.calls[0][0];
    return params.messages.find((m) => m.role === 'system').content;
}

describe('AI Assistant - language rule', () => {
    let savedKey;

    beforeEach(() => {
        savedKey = process.env.LLM_API_KEY;
        process.env.LLM_API_KEY = 'test-key';
        mockCreate.mockReset();
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content:
                            '{"overview":"ok","focus":"ok","priority_actions":[],"watch_out":[],"insight":"ok"}',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        if (savedKey === undefined) delete process.env.LLM_API_KEY;
        else process.env.LLM_API_KEY = savedKey;
    });

    it('writes the daily brief in the user language', async () => {
        const user = await createTestUser({
            email: 'ai-lang-brief@example.com',
            language: 'el',
        });

        await aiAssistantService.generateDailyBrief(user.id);

        expect(systemPrompt()).toMatch(/LANGUAGE RULE: .*in Greek/);
    });

    it('maps non-standard app language codes for the daily brief', async () => {
        const user = await createTestUser({
            email: 'ai-lang-brief-jp@example.com',
            language: 'jp',
        });

        await aiAssistantService.generateDailyBrief(user.id);

        expect(systemPrompt()).toMatch(/LANGUAGE RULE: .*in Japanese/);
    });

    it('tells project insights to answer in the project language', async () => {
        await aiAssistantService.generateProjectInsights(
            { projectName: 'Ανακαίνιση κουζίνας' },
            null
        );

        expect(systemPrompt()).toContain(
            'LANGUAGE RULE: Detect the language of the project name'
        );
    });
});
