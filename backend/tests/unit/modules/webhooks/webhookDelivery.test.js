const http = require('http');
const bcrypt = require('bcrypt');

// These tests exercise real delivery mechanics (signing, headers, retries,
// failure counting) against a local HTTP server, which the SSRF guard would
// otherwise reject as a private/loopback address. ssrfGuard itself has its
// own dedicated test coverage (tests/unit/modules/url/ssrfGuard.test.js).
jest.mock('../../../../modules/url/ssrfGuard');

const { assertSafeUrl } = require('../../../../modules/url/ssrfGuard');
const { WebhookEndpoint, User } = require('../../../../models');
const {
    signPayload,
    buildPayload,
    buildAuthHeaders,
    deliver,
} = require('../../../../modules/webhooks/webhookDelivery');

// jest.config.js sets resetMocks: true, which wipes any implementation set
// on module load, so it has to be (re)installed before every test instead.
beforeEach(() => {
    assertSafeUrl.mockImplementation(async (urlLike) =>
        typeof urlLike === 'string' ? new URL(urlLike) : urlLike
    );
});

function startServer(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function serverUrl(server) {
    const { port } = server.address();
    return `http://127.0.0.1:${port}/hook`;
}

describe('webhookDelivery', () => {
    let testUser;

    beforeEach(async () => {
        testUser = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('signPayload', () => {
        it('produces a deterministic HMAC-SHA256 hex digest', () => {
            const signature = signPayload('secret', '{"a":1}');
            expect(signature).toMatch(/^[0-9a-f]{64}$/);
            expect(signPayload('secret', '{"a":1}')).toBe(signature);
            expect(signPayload('other-secret', '{"a":1}')).not.toBe(signature);
        });
    });

    describe('buildPayload', () => {
        it('shapes the notification into the delivery payload', () => {
            const payload = buildPayload({
                uid: 'abc',
                type: 'task_due_soon',
                title: 'Title',
                message: 'Message',
                level: 'warning',
                data: { taskUid: 'x' },
                created_at: '2026-01-01T00:00:00.000Z',
            });

            expect(payload).toEqual({
                id: 'abc',
                type: 'task_due_soon',
                title: 'Title',
                message: 'Message',
                level: 'warning',
                data: { taskUid: 'x' },
                created_at: '2026-01-01T00:00:00.000Z',
            });
        });
    });

    describe('buildAuthHeaders', () => {
        it('returns no extra headers for auth_type none', () => {
            expect(buildAuthHeaders({ auth_type: 'none' })).toEqual({});
        });

        it('builds a Basic Authorization header', () => {
            const headers = buildAuthHeaders({
                auth_type: 'basic',
                auth_username: 'alice',
                auth_secret: 'wonderland',
            });
            expect(headers).toEqual({
                Authorization: `Basic ${Buffer.from('alice:wonderland').toString('base64')}`,
            });
        });

        it('builds a custom Header Auth header, defaulting the name to Authorization', () => {
            expect(
                buildAuthHeaders({
                    auth_type: 'header',
                    auth_header_name: null,
                    auth_secret: 'my-token',
                })
            ).toEqual({ Authorization: 'my-token' });

            expect(
                buildAuthHeaders({
                    auth_type: 'header',
                    auth_header_name: 'X-Api-Key',
                    auth_secret: 'my-token',
                })
            ).toEqual({ 'X-Api-Key': 'my-token' });
        });
    });

    describe('deliver', () => {
        let server;
        let received;

        afterEach(async () => {
            received = [];
            if (server) {
                await new Promise((resolve) => server.close(resolve));
                server = null;
            }
        });

        it('sends a signed POST and records success on the endpoint', async () => {
            received = [];
            server = await startServer((req, res) => {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                    received.push({ headers: req.headers, body });
                    res.writeHead(200);
                    res.end('ok');
                });
            });

            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Test endpoint',
                url: serverUrl(server),
                secret: 'test-secret',
            });

            const payload = buildPayload({
                uid: 'notif-1',
                type: 'task_due_soon',
                title: 'Title',
                message: 'Message',
                level: 'info',
                data: null,
                created_at: new Date().toISOString(),
            });

            const result = await deliver(endpoint, payload);

            expect(result.success).toBe(true);
            expect(received).toHaveLength(1);

            const expectedSignature = signPayload(
                'test-secret',
                received[0].body
            );
            expect(received[0].headers['x-tududi-signature']).toBe(
                `sha256=${expectedSignature}`
            );
            expect(received[0].headers['x-tududi-event']).toBe('task_due_soon');

            await endpoint.reload();
            expect(endpoint.last_delivery_status).toBe('success');
            expect(endpoint.failure_count).toBe(0);
        });

        it('sends the configured auth header alongside the signature', async () => {
            received = [];
            server = await startServer((req, res) => {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                    received.push({ headers: req.headers, body });
                    res.writeHead(200);
                    res.end('ok');
                });
            });

            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Authed endpoint',
                url: serverUrl(server),
                secret: 'test-secret',
                auth_type: 'header',
                auth_header_name: 'Authorization',
                auth_secret: 'n8n-token',
            });

            const payload = buildPayload({
                uid: 'notif-4',
                type: 'task_due_soon',
                title: 'Title',
                message: 'Message',
                level: 'info',
                data: null,
                created_at: new Date().toISOString(),
            });

            const result = await deliver(endpoint, payload);

            expect(result.success).toBe(true);
            expect(received[0].headers['authorization']).toBe('n8n-token');
            expect(received[0].headers['x-tududi-signature']).toBeDefined();
        });

        it('retries once on a 5xx response and records the failure', async () => {
            let requestCount = 0;
            server = await startServer((req, res) => {
                requestCount++;
                req.on('data', () => {});
                req.on('end', () => {
                    res.writeHead(500);
                    res.end('nope');
                });
            });

            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Flaky endpoint',
                url: serverUrl(server),
                secret: 'test-secret',
            });

            const payload = buildPayload({
                uid: 'notif-2',
                type: 'task_overdue',
                title: 'Title',
                message: 'Message',
                level: 'error',
                data: null,
                created_at: new Date().toISOString(),
            });

            const result = await deliver(endpoint, payload);

            expect(result.success).toBe(false);
            expect(requestCount).toBe(2); // one retry on 5xx

            await endpoint.reload();
            expect(endpoint.last_delivery_status).toBe('failed');
            expect(endpoint.failure_count).toBe(1);
            expect(endpoint.active).toBe(true);
        });

        it('auto-disables the endpoint after too many consecutive failures', async () => {
            server = await startServer((req, res) => {
                req.on('data', () => {});
                req.on('end', () => {
                    res.writeHead(500);
                    res.end('nope');
                });
            });

            const endpoint = await WebhookEndpoint.create({
                user_id: testUser.id,
                name: 'Always failing endpoint',
                url: serverUrl(server),
                secret: 'test-secret',
            });

            const payload = buildPayload({
                uid: 'notif-3',
                type: 'task_overdue',
                title: 'Title',
                message: 'Message',
                level: 'error',
                data: null,
                created_at: new Date().toISOString(),
            });

            for (let i = 0; i < 10; i++) {
                await deliver(endpoint, payload);
                await endpoint.reload();
            }

            expect(endpoint.failure_count).toBe(10);
            expect(endpoint.active).toBe(false);
        });
    });
});
