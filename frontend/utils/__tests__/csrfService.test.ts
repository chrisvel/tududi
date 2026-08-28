import { getCsrfToken, clearCsrfToken } from '../csrfService';

// jsdom has no Response constructor, so stub the parts fetch callers use
const jsonResponse = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response;

describe('getCsrfToken', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        clearCsrfToken();
        jest.restoreAllMocks();
    });

    it('fetches and caches the token', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(200, { csrfToken: 'abc123' })
            ) as jest.Mock;

        await expect(getCsrfToken()).resolves.toBe('abc123');
        await expect(getCsrfToken()).resolves.toBe('abc123');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // #1417: a failed CSRF fetch (e.g. offline) must not block the caller's
    // own mutating fetch() from ever being dispatched - resolving '' lets
    // the request still reach the service worker's offline queue instead.
    it('resolves an empty string instead of rejecting when the network is unreachable', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValue(new TypeError('Failed to fetch')) as jest.Mock;

        await expect(getCsrfToken()).resolves.toBe('');
    });

    it('resolves an empty string when the server responds with an error status', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(503, { error: 'Offline', offline: true })
            ) as jest.Mock;

        await expect(getCsrfToken()).resolves.toBe('');
    });

    it('does not retry the network again within the backoff window after a failure', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValue(new TypeError('Failed to fetch')) as jest.Mock;

        await getCsrfToken();
        await getCsrfToken();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries immediately once the browser reports connectivity again', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValue(new TypeError('Failed to fetch')) as jest.Mock;

        await getCsrfToken();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('online'));

        (global.fetch as jest.Mock).mockResolvedValue(
            jsonResponse(200, { csrfToken: 'xyz789' })
        );

        await expect(getCsrfToken()).resolves.toBe('xyz789');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
