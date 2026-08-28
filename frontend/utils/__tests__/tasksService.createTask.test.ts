import { createTask } from '../tasksService';
import { OfflineQueuedError } from '../authUtils';
import { clearCsrfToken } from '../csrfService';

// jsdom has no Response constructor, so stub the parts fetch callers use
const jsonResponse = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (key: string) => headers[key] ?? null },
        json: async () => body,
    }) as Response;

describe('createTask', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        clearCsrfToken();
        jest.restoreAllMocks();
    });

    it('resolves the created task on success', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok' })) // GET /csrf-token
            .mockResolvedValueOnce(
                jsonResponse(201, { id: 1, uid: 'abc', name: 'Buy milk' })
            ) as jest.Mock; // POST /task

        await expect(createTask({ name: 'Buy milk' } as any)).resolves.toEqual(
            { id: 1, uid: 'abc', name: 'Buy milk' }
        );
    });

    // #1417: when the network is unavailable, the CSRF fetch degrades
    // gracefully (see csrfService.test.ts) so the actual POST still fires
    // and reaches the service worker's offline queue instead of failing
    // before ever being dispatched.
    it('throws OfflineQueuedError when the request was queued for offline sync', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch')) // GET /csrf-token fails offline
            .mockResolvedValueOnce(
                jsonResponse(
                    202,
                    { queued: true, offline: true },
                    { 'X-Tududi-Queued': '1' }
                )
            ) as jest.Mock; // POST /task queued by the service worker

        await expect(createTask({ name: 'Buy milk' } as any)).rejects.toBeInstanceOf(
            OfflineQueuedError
        );
    });
});
