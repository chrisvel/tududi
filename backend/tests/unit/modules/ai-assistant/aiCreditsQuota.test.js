const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');
const entitlements = require('../../../../services/entitlementsService');
const plans = require('../../../../config/plans');
const { getConfig } = require('../../../../config/config');

const OK_RESPONSE = {
    choices: [{ message: { content: '{}' } }],
    model: 'test-model',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

// One credit is spent per generation (see the consumeMonthlyUsage call
// alongside the existing ai_requests one in each generate* function) -
// exhausting a hosted plan's monthly ai_credits allowance must block
// further generation with the same PlanLimitError every other plan limit
// uses, not silently keep going.
describe('AI Assistant - AI Credits monthly quota', () => {
    const config = getConfig();

    beforeEach(() => {
        process.env.LLM_API_KEY = 'test-key';
        process.env.TUDUDI_PLANS_JSON = JSON.stringify({
            free: {
                limits: { ai_credits_per_month: 2, ai_requests_per_day: 999 },
            },
        });
        plans._resetCache();
        config.hosted.enabled = true;
        // A fresh account otherwise gets a trial-period 'pro' plan (see
        // ensureAccount/resolvePlan), not 'free'.
        config.hosted.trialDays = 0;

        mockCreate.mockReset();
        mockCreate.mockResolvedValue(OK_RESPONSE);
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        delete process.env.LLM_API_KEY;
        delete process.env.TUDUDI_PLANS_JSON;
        plans._resetCache();
        config.hosted.enabled = false;
        config.hosted.trialDays = 14;
        entitlements.invalidate();
    });

    it('blocks generation once the monthly credit allowance is exhausted', async () => {
        const user = await createTestUser({
            email: `credits-quota-${Date.now()}@example.com`,
        });

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            user.id
        );
        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            user.id
        );

        await expect(
            aiAssistantService.generateProjectInsights(
                { projectName: 'Website redesign' },
                user.id
            )
        ).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });

        // Only the first two calls should have reached the provider.
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });
});
