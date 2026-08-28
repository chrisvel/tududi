import {
    handleAuthResponse,
    isQueuedOfflineResponse,
    OfflineQueuedError,
} from '../authUtils';

// jsdom has no Response constructor, so stub the parts callers use
const makeResponse = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (key: string) => headers[key] ?? null },
        json: async () => body,
    }) as unknown as Response;

describe('isQueuedOfflineResponse', () => {
    it('is true only when the service worker set the queued marker header', () => {
        expect(
            isQueuedOfflineResponse(
                makeResponse(202, { queued: true }, {
                    'X-Tududi-Queued': '1',
                })
            )
        ).toBe(true);
        expect(isQueuedOfflineResponse(makeResponse(200, { id: 1 }))).toBe(
            false
        );
    });
});

describe('handleAuthResponse', () => {
    // #1417: a mutation queued for background sync (see handleApiMutation
    // in public/sw.js) must not be treated as if the placeholder { queued:
    // true } body were the real created/updated resource.
    it('throws OfflineQueuedError for a service-worker-queued response', async () => {
        const response = makeResponse(
            202,
            { queued: true, offline: true },
            { 'X-Tududi-Queued': '1' }
        );

        await expect(
            handleAuthResponse(response, 'Failed to create task.')
        ).rejects.toBeInstanceOf(OfflineQueuedError);
    });

    it('passes a normal successful response through unchanged', async () => {
        const response = makeResponse(200, { id: 1 });

        await expect(
            handleAuthResponse(response, 'Failed to create task.')
        ).resolves.toBe(response);
    });

    it('still throws the auth error for a 401', async () => {
        jest.useFakeTimers();
        try {
            const response = makeResponse(401, { error: 'Unauthorized' });

            await expect(
                handleAuthResponse(response, 'Failed to fetch tasks.')
            ).rejects.toThrow('Authentication required');
        } finally {
            jest.useRealTimers();
        }
    });

    it('surfaces the backend error message for other failures', async () => {
        const response = makeResponse(404, { error: 'Task not found.' });

        await expect(
            handleAuthResponse(response, 'Failed to fetch task.')
        ).rejects.toThrow('Task not found.');
    });
});
