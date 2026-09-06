import {
    fetchBillingStatus,
    startCheckout,
    syncCheckout,
    formatBytes,
} from '../billingService';
import { PlanLimitError, PLAN_LIMIT_EVENT } from '../planLimits';
import { handleAuthResponse } from '../authUtils';

jest.mock('../csrfService', () => ({
    getCsrfToken: async () => 'csrf-token',
}));

const makeResponse = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => body,
    }) as unknown as Response;

describe('billingService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('loads the billing status', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                makeResponse(200, { plan: 'free', hosted: true })
            );
        const status = await fetchBillingStatus();
        expect(status.plan).toBe('free');
        expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
            'billing'
        );
    });

    it('posts the interval with a CSRF token and returns the checkout url', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                makeResponse(200, { url: 'https://checkout.stripe.test/x' })
            );
        const url = await startCheckout('year');
        expect(url).toBe('https://checkout.stripe.test/x');
        const [, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(options.method).toBe('POST');
        expect(options.headers['x-csrf-token']).toBe('csrf-token');
        expect(JSON.parse(options.body)).toEqual({ interval: 'year' });
    });

    it('sends the session id when syncing after checkout', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(makeResponse(200, { plan: 'pro' }));
        await syncCheckout('cs_123');
        const [, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(JSON.parse(options.body)).toEqual({ session_id: 'cs_123' });
    });

    it('formats byte sizes for humans', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2 KB');
        expect(formatBytes(50 * 1024 * 1024)).toBe('50.0 MB');
        expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
    });
});

describe('handleAuthResponse on 402', () => {
    it('throws a PlanLimitError and broadcasts the detail', async () => {
        const listener = jest.fn();
        window.addEventListener(PLAN_LIMIT_EVENT, listener);
        const body = {
            error: 'Your free plan allows 200 tasks',
            code: 'PLAN_LIMIT_REACHED',
            details: {
                resource: 'task',
                limit: 200,
                current: 200,
                plan: 'free',
            },
        };

        await expect(
            handleAuthResponse(makeResponse(402, body), 'fallback')
        ).rejects.toBeInstanceOf(PlanLimitError);

        expect(listener).toHaveBeenCalledTimes(1);
        expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual(body);
        window.removeEventListener(PLAN_LIMIT_EVENT, listener);
    });
});
