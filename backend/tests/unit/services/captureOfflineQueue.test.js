const fs = require('fs');
const path = require('path');
const vm = require('vm');

function worker(query = '') {
    const context = {
        self: {
            location: new URL(`https://tududi.test/sw.js${query}`),
            addEventListener: jest.fn(),
            registration: {},
            clients: { matchAll: jest.fn().mockResolvedValue([]) },
        },
        URL,
        Response,
        fetch: jest.fn(),
    };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(
            path.join(__dirname, '../../../../public/sw.js'),
            'utf8'
        ),
        context
    );
    return context;
}

describe('capture offline replay', () => {
    it('preserves the body and delivery ID after a consumed request loses its response', async () => {
        const context = worker();
        const body = JSON.stringify({
            content: 'My task name +Personal =Task',
            request_id: 'stable-id',
        });
        context.fetch.mockImplementation(async (request) => {
            await request.text();
            throw new Error('Response lost');
        });
        let queuedBody;
        context.queueRequest = jest.fn(async (request) => {
            queuedBody = await request.text();
        });
        const response = await context.handleApiMutation(
            new Request('https://example.com/api/inbox/capture', {
                method: 'POST',
                body,
            })
        );
        expect(response.status).toBe(202);
        expect(response.headers.get('X-Tududi-Queued')).toBe('1');
        expect(queuedBody).toBe(body);
    });

    it.each([false, true])(
        'only reports queued after the write commits, with sync registration denied: %s',
        async (denied) => {
            const context = worker();
            const transaction = {
                objectStore: () => ({ add: jest.fn() }),
                oncomplete: null,
                onerror: null,
                onabort: null,
                error: null,
            };
            context.openQueueDb = jest
                .fn()
                .mockResolvedValue({ transaction: () => transaction });
            context.self.registration.sync = {
                register: denied
                    ? jest
                          .fn()
                          .mockRejectedValue(new Error('Permission denied'))
                    : jest.fn().mockResolvedValue(undefined),
            };
            let settled = false;
            const queued = context
                .queueRequest(
                    new Request('https://example.com/api/inbox/capture', {
                        method: 'POST',
                        body: '{}',
                    })
                )
                .then(() => {
                    settled = true;
                });
            // Wait for the transaction handlers without using wall-clock timers.
            for (let i = 0; i < 20 && !transaction.oncomplete; i++)
                await Promise.resolve();
            expect(settled).toBe(false);
            expect(transaction.oncomplete).toEqual(expect.any(Function));
            transaction.oncomplete();
            await queued;
            expect(settled).toBe(true);
        }
    );

    it('replays the same body across retries and removes it only after success', async () => {
        const context = worker();
        const body = JSON.stringify({
            content: 'Name =Task',
            request_id: 'stable-id',
        });
        const remove = jest.fn();
        context.openQueueDb = jest.fn().mockResolvedValue({
            transaction: () => ({
                objectStore: () => ({ delete: remove }),
            }),
        });
        context.idbAll = jest.fn().mockResolvedValue([
            {
                id: 1,
                url: 'https://example.com/api/inbox/capture',
                method: 'POST',
                body,
                headers: {},
                sessionId: null,
            },
        ]);
        context.fetch
            .mockRejectedValueOnce(new Error('Offline'))
            .mockResolvedValueOnce({ ok: true });
        await context.replayQueuedRequests();
        expect(remove).not.toHaveBeenCalled();
        await context.replayQueuedRequests();
        expect(context.fetch).toHaveBeenNthCalledWith(
            1,
            'https://example.com/api/inbox/capture',
            expect.objectContaining({ body })
        );
        expect(context.fetch).toHaveBeenNthCalledWith(
            2,
            'https://example.com/api/inbox/capture',
            expect.objectContaining({ body })
        );
        expect(remove).toHaveBeenCalledWith(1);
    });
    it('accepts a reconnect message when background sync is unavailable', async () => {
        const context = worker();
        context.replayQueuedRequests = jest.fn().mockResolvedValue(undefined);
        const handler = context.self.addEventListener.mock.calls.find(
            ([name]) => name === 'message'
        )[1];
        const waitUntil = jest.fn();
        handler({ data: { type: 'REPLAY_QUEUE' }, waitUntil });
        expect(context.replayQueuedRequests).toHaveBeenCalledTimes(1);
        await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    });
    it('does not replay captures in the development push-only worker', () => {
        const context = worker('?push-only');
        context.replayQueuedRequests = jest.fn();
        const handler = context.self.addEventListener.mock.calls.find(
            ([name]) => name === 'message'
        )[1];
        const waitUntil = jest.fn();
        handler({ data: { type: 'REPLAY_QUEUE' }, waitUntil });
        expect(context.replayQueuedRequests).not.toHaveBeenCalled();
        expect(waitUntil).not.toHaveBeenCalled();
    });
});
