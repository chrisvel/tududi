const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');

describe('AI Assistant - configurable max_tokens', () => {
    const savedEnv = {};
    const ENV_KEYS = [
        'LLM_API_KEY',
        'LLM_MAX_TOKENS_DAILY_BRIEF',
        'LLM_MAX_TOKENS_TASK_INSIGHTS',
        'LLM_MAX_TOKENS_PROJECT_INSIGHTS',
        'LLM_DISABLE_THINKING',
    ];

    beforeEach(() => {
        ENV_KEYS.forEach((key) => {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        });
        process.env.LLM_API_KEY = 'test-key';

        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        });
    });

    it('defaults task insights to 1000 max_tokens when unset', async () => {
        await aiAssistantService.generateTaskInsights(
            { taskName: 'Write the report', taskStatus: 0, taskPriority: 1 },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 1000 })
        );
    });

    it('uses LLM_MAX_TOKENS_TASK_INSIGHTS when set', async () => {
        process.env.LLM_MAX_TOKENS_TASK_INSIGHTS = '222';

        await aiAssistantService.generateTaskInsights(
            { taskName: 'Write the report', taskStatus: 0, taskPriority: 1 },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 222 })
        );
    });

    it('defaults project insights to 600 max_tokens when unset', async () => {
        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 600 })
        );
    });

    it('uses LLM_MAX_TOKENS_PROJECT_INSIGHTS when set', async () => {
        process.env.LLM_MAX_TOKENS_PROJECT_INSIGHTS = '111';

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 111 })
        );
    });

    it('falls back to the default when the env var is not a valid number', async () => {
        process.env.LLM_MAX_TOKENS_PROJECT_INSIGHTS = 'not-a-number';

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 600 })
        );
    });

    it('defaults the daily brief to 1500 max_tokens when unset', async () => {
        const user = await createTestUser({ email: 'ai-tokens@example.com' });

        await aiAssistantService.generateDailyBrief(user.id);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 1500 })
        );
    });

    it('uses LLM_MAX_TOKENS_DAILY_BRIEF when set', async () => {
        process.env.LLM_MAX_TOKENS_DAILY_BRIEF = '250';
        const user = await createTestUser({ email: 'ai-tokens-2@example.com' });

        await aiAssistantService.generateDailyBrief(user.id);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 250 })
        );
    });

    it('does not send chat_template_kwargs by default', async () => {
        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        const params = mockCreate.mock.calls[0][0];
        expect(params.chat_template_kwargs).toBeUndefined();
    });

    it('sends chat_template_kwargs.enable_thinking=false when LLM_DISABLE_THINKING=true', async () => {
        process.env.LLM_DISABLE_THINKING = 'true';

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                chat_template_kwargs: { enable_thinking: false },
            })
        );
    });

    it('falls back to message.reasoning when content is null', async () => {
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: null,
                        reasoning:
                            '{"insight":"from reasoning field","next_action":"ship it","health":"on track","watch_out":null}',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });

        const result = await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(result.insight).toBe('from reasoning field');
        expect(result.next_action).toBe('ship it');
    });

    it('falls back to message.reasoning_content when content is null', async () => {
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: null,
                        reasoning_content:
                            '{"insight":"from reasoning_content field","next_action":"ship it","health":"on track","watch_out":null}',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });

        const result = await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(result.insight).toBe('from reasoning_content field');
    });

    it('prefers content over reasoning fields when both are present', async () => {
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content:
                            '{"insight":"from content field","next_action":"ship it","health":"on track","watch_out":null}',
                        reasoning: '{"insight":"should be ignored"}',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });

        const result = await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(result.insight).toBe('from content field');
    });

    it('does not leak non-JSON chain-of-thought from reasoning_content into the daily brief', async () => {
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: null,
                        reasoning_content:
                            '<think>let me consider what the user needs today...',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 1500 },
        });
        const user = await createTestUser({
            email: 'ai-tokens-leak-1@example.com',
        });

        const result = await aiAssistantService.generateDailyBrief(user.id);

        expect(result.focus).toBe('');
        expect(result.priority_actions).toEqual([]);
    });

    it('does not leak non-JSON chain-of-thought from reasoning into the daily brief', async () => {
        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: null,
                        reasoning:
                            'Thinking Process:\n1. Analyze the user context...',
                    },
                },
            ],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 1500 },
        });
        const user = await createTestUser({
            email: 'ai-tokens-leak-2@example.com',
        });

        const result = await aiAssistantService.generateDailyBrief(user.id);

        expect(result.focus).toBe('');
        expect(result.priority_actions).toEqual([]);
    });
});
