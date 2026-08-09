import { deleteTask } from '../tasksService';

jest.mock('../authUtils', () => ({
    handleAuthResponse: jest.fn(async (response: Response, message: string) => {
        if (!response.ok) throw new Error(message);
        return response;
    }),
    getDefaultHeaders: () => ({}),
    getPostHeadersWithCsrf: async () => ({}),
}));

// jsdom has no Response constructor, so stub the parts fetch callers use
const jsonResponse = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response;

describe('deleteTask', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('resolves when the task is deleted', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(200, { message: 'Task successfully deleted' })
            ) as jest.Mock;

        await expect(deleteTask('abcdefghijklmno')).resolves.toBeUndefined();
    });

    // #1371: a stale row pointing at a task that no longer exists must be
    // removable from the UI instead of failing every delete attempt.
    it('resolves when the task no longer exists', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(404, { error: 'Task not found.' })
            ) as jest.Mock;

        await expect(deleteTask('abcdefghijklmno')).resolves.toBeUndefined();
    });

    it('still rejects when the task exists but is not accessible', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(403, { error: 'Forbidden' })
            ) as jest.Mock;

        await expect(deleteTask('abcdefghijklmno')).rejects.toThrow(
            'Failed to delete task.'
        );
    });
});
