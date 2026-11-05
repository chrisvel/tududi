'use strict';

const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const { Task } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');
const aiAssistantService = require('../../../../modules/ai-assistant/service');

describe('AI Assistant - daily brief logging', () => {
    const savedApiKey = process.env.LLM_API_KEY;
    let logSpy;
    let infoSpy;
    let debugSpy;

    beforeEach(() => {
        process.env.LLM_API_KEY = 'test-key';
        mockCreate.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));

        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        infoSpy.mockRestore();
        debugSpy.mockRestore();

        if (savedApiKey === undefined) {
            delete process.env.LLM_API_KEY;
        } else {
            process.env.LLM_API_KEY = savedApiKey;
        }
    });

    it('does not log raw LLM response or task names to console during generateDailyBrief', async () => {
        const distinctiveTaskName = 'TASK-2044-CONFIDENTIAL-LAUNCH-PLAN';
        const rawPayload = JSON.stringify({
            overview: 'Progressing on track towards launch.',
            focus: distinctiveTaskName,
            priority_actions: [
                {
                    action: distinctiveTaskName,
                    project: 'Confidential Project',
                    reason: 'Critical deliverable',
                    suggestion: 'Complete the security review first.',
                },
            ],
            watch_out: [],
        });

        mockCreate.mockResolvedValue({
            choices: [{ message: { content: rawPayload } }],
            model: 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 20 },
        });

        const user = await createTestUser({
            email: 'daily-brief-logging@example.com',
        });

        await Task.create({
            name: distinctiveTaskName,
            user_id: user.id,
            status: Task.STATUS.IN_PROGRESS,
        });

        const result = await aiAssistantService.generateDailyBrief(user.id);

        expect(result.focus).toBe(distinctiveTaskName);

        const allConsoleOutput = [
            ...logSpy.mock.calls,
            ...infoSpy.mock.calls,
            ...debugSpy.mock.calls,
        ]
            .flat()
            .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
            .join(' ');

        expect(allConsoleOutput).not.toContain(distinctiveTaskName);
    });
});
