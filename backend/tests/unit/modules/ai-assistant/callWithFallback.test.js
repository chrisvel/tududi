const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const aiAssistantService = require('../../../../modules/ai-assistant/service');

function makeError(props) {
    const err = new Error(props.message || 'Bad Request');
    Object.assign(err, props);
    return err;
}

const OK_RESPONSE = {
    choices: [{ message: { content: '{}' } }],
    model: 'test-model',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

describe('AI Assistant - callWithFallback max_completion_tokens retry', () => {
    const savedApiKey = process.env.LLM_API_KEY;

    beforeEach(() => {
        process.env.LLM_API_KEY = 'test-key';
        mockCreate.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));
    });

    afterEach(() => {
        if (savedApiKey === undefined) {
            delete process.env.LLM_API_KEY;
        } else {
            process.env.LLM_API_KEY = savedApiKey;
        }
    });

    it('swaps max_tokens for max_completion_tokens and retries once when the provider rejects max_tokens', async () => {
        mockCreate
            .mockRejectedValueOnce(
                makeError({
                    status: 400,
                    code: 'unsupported_parameter',
                    param: 'max_tokens',
                    type: 'invalid_request_error',
                    message:
                        "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
                })
            )
            .mockResolvedValueOnce(OK_RESPONSE);

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(mockCreate.mock.calls[0][0]).toEqual(
            expect.objectContaining({ max_tokens: 600 })
        );
        const retry = mockCreate.mock.calls[1][0];
        expect(retry.max_tokens).toBeUndefined();
        expect(retry.max_completion_tokens).toBe(600);
    });

    it('reads the rejection details from a nested error body', async () => {
        mockCreate
            .mockRejectedValueOnce(
                makeError({
                    status: 400,
                    error: {
                        code: 'unsupported_parameter',
                        param: 'max_tokens',
                        message: "Unsupported parameter: 'max_tokens'",
                    },
                })
            )
            .mockResolvedValueOnce(OK_RESPONSE);

        await aiAssistantService.generateTaskInsights(
            { taskName: 'Write the report', taskStatus: 0, taskPriority: 1 },
            null
        );

        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(mockCreate.mock.calls[1][0].max_completion_tokens).toBe(1000);
    });

    it('does not retry when a 400 is unrelated to max_tokens', async () => {
        mockCreate.mockRejectedValueOnce(
            makeError({
                status: 400,
                code: 'invalid_api_key',
                message: 'Incorrect API key provided',
            })
        );

        await expect(
            aiAssistantService.generateProjectInsights(
                { projectName: 'Website redesign' },
                null
            )
        ).rejects.toThrow('Incorrect API key provided');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('gives up if the swapped retry is rejected again', async () => {
        mockCreate.mockRejectedValue(
            makeError({
                status: 400,
                code: 'unsupported_parameter',
                param: 'max_tokens',
                message: "Unsupported parameter: 'max_tokens'",
            })
        );

        await expect(
            aiAssistantService.generateProjectInsights(
                { projectName: 'Website redesign' },
                null
            )
        ).rejects.toThrow();
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('composes the max_tokens swap with the response_format drop', async () => {
        mockCreate
            .mockRejectedValueOnce(
                makeError({
                    status: 400,
                    code: 'unsupported_parameter',
                    param: 'max_tokens',
                    message: "Unsupported parameter: 'max_tokens'",
                })
            )
            .mockRejectedValueOnce(
                makeError({
                    status: 400,
                    message: "Unsupported value: 'response_format'",
                })
            )
            .mockResolvedValueOnce(OK_RESPONSE);

        await aiAssistantService.generateProjectInsights(
            { projectName: 'Website redesign' },
            null
        );

        expect(mockCreate).toHaveBeenCalledTimes(3);
        const finalCall = mockCreate.mock.calls[2][0];
        expect(finalCall.max_tokens).toBeUndefined();
        expect(finalCall.max_completion_tokens).toBe(600);
        expect(finalCall.response_format).toBeUndefined();
    });
});
