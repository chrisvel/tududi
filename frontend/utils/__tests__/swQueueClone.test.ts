/**
 * @jest-environment node
 */
// T-305: the sw.js offline queue pattern — clone() the request BEFORE
// fetch(), otherwise fetch consumes the body and the queue stores ""
// (G5 finding 1: replay then POSTed an empty body and the entry never
// cleared). This pins the exact pattern handleApiMutation now uses.

const hasFetchRequest = typeof Request !== 'undefined';

(hasFetchRequest ? describe : describe.skip)('sw queue clone pattern', () => {
    it('keeps the body after the original request is consumed', async () => {
        const payload = JSON.stringify({ name: 'queued task' });
        const request = new Request('http://localhost/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });

        // The fixed order: clone first, then fetch (simulated here by
        // consuming the original body, which is what fetch does).
        const requestForQueue = request.clone();
        await request.text(); // fetch consumed the original

        // The original is now unusable (the old bug read from here)...
        await expect(request.text()).rejects.toThrow();
        // ...but the queued clone still carries the full body.
        await expect(requestForQueue.text()).resolves.toBe(payload);
    });

    it('reading the original first (old order) loses the body', async () => {
        const request = new Request('http://localhost/api/task', {
            method: 'POST',
            body: JSON.stringify({ name: 'x' }),
        });
        await request.text();
        // This is why queueRequest used request.text().catch(() => '') and
        // silently stored an empty body.
        await expect(request.text()).rejects.toThrow();
    });
});
