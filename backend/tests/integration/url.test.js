const dns = require('dns');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');
const request = require('supertest');
const { createTestUser } = require('../helpers/testUtils');

// Only the third-party proxy fallback uses fetch; keep it offline.
global.fetch = jest.fn();

const app = require('../../app');

// Page fetches go through http/https (pinned to public addresses at connect
// time), so the tests answer those instead of touching the network.

// supertest itself talks to the app over http.request, so only calls that
// carry the URL fetcher's pinned lookup are answered here.
const realRequest = { http: http.request, https: https.request };
const outbound = () =>
    [...http.request.mock.calls, ...https.request.mock.calls].filter(
        ([options]) => options && options.lookup
    );

function answerRequests(respond) {
    for (const [name, mod] of Object.entries({ http, https })) {
        jest.spyOn(mod, 'request').mockImplementation((...args) => {
            const [options, callback] = args;
            if (!options || !options.lookup) {
                return realRequest[name].apply(mod, args);
            }
            const req = new EventEmitter();
            req.end = () => respond(req, callback);
            req.destroy = jest.fn();
            return req;
        });
    }
}

function serveHtml(html) {
    answerRequests((req, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html; charset=utf-8' };
        res.resume = jest.fn();
        res.destroy = jest.fn();
        callback(res);
        process.nextTick(() => {
            res.emit('data', Buffer.from(html));
            res.emit('end');
        });
    });
}

function failRequests(message) {
    answerRequests((req) =>
        process.nextTick(() => req.emit('error', new Error(message)))
    );
}

describe('URL Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });

        // Reset mocks before each test
        jest.restoreAllMocks();
        jest.clearAllMocks();
        global.fetch.mockRejectedValue(new Error('offline'));
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
        ]);
        failRequests('no response configured');
    });

    describe('GET /api/url/title', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/url/title')
                .query({ url: 'https://example.com' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require url parameter', async () => {
            const response = await agent.get('/api/url/title');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('URL parameter is required');
        });

        it('should return title for valid URL', async () => {
            serveHtml(
                '<html><head><title>Herman Melville - Moby-Dick</title></head></html>'
            );

            const response = await agent
                .get('/api/url/title')
                .query({ url: 'https://httpbin.org/html' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('https://httpbin.org/html');
            expect(response.body.title).toBe('Herman Melville - Moby-Dick');
        });

        it('should handle URL without protocol', async () => {
            serveHtml('<html><head><title>Test Page</title></head></html>');

            const response = await agent
                .get('/api/url/title')
                .query({ url: 'httpbin.org/html' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('httpbin.org/html');
            expect(response.body.title).toBe('Test Page');
        });

        it('should handle invalid URL gracefully', async () => {
            failRequests('getaddrinfo ENOTFOUND not-a-valid-url');

            const response = await agent
                .get('/api/url/title')
                .query({ url: 'not-a-valid-url' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('not-a-valid-url');
            expect(response.body.title).toBe(null);
        });

        it('should handle unreachable URL', async () => {
            failRequests('getaddrinfo ENOTFOUND nonexistent-domain-12345.com');

            const response = await agent
                .get('/api/url/title')
                .query({ url: 'https://nonexistent-domain-12345.com' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe(
                'https://nonexistent-domain-12345.com'
            );
            expect(response.body.title).toBe(null);
        });

        it('should block requests to the cloud metadata endpoint (SSRF)', async () => {
            const response = await agent.get('/api/url/title').query({
                url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
            });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe(null);
            expect(response.body.error).toBe('Could not extract metadata');
            expect(outbound()).toHaveLength(0);
        });

        it('should block requests to private/loopback IPs (SSRF)', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'http://192.168.1.1:9000' });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe(null);
            expect(outbound()).toHaveLength(0);
        });

        it('should block requests to non-standard ports (SSRF)', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'http://example.com:8080/' });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe(null);
            expect(outbound()).toHaveLength(0);
        });
    });

    describe('POST /api/url/extract-from-text', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/url/extract-from-text')
                .send({ text: 'Check out https://example.com' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require text parameter', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text parameter is required');
        });

        it('should extract URL from text and get title', async () => {
            serveHtml(
                '<html><head><title>Herman Melville - Moby-Dick</title><meta name="description" content="A classic novel"></head></html>'
            );

            const testText =
                'Check out this interesting site: https://httpbin.org/html';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('https://httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
            expect(response.body.title).toBe('Herman Melville - Moby-Dick');
        });

        it('should extract first URL when multiple URLs in text', async () => {
            serveHtml('<html><head><title>Test Page</title></head></html>');

            const testText =
                'Check out https://httpbin.org/html and also https://example.com';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('https://httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
            expect(response.body.title).toBe('Test Page');
        });

        it('should detect URLs without protocol', async () => {
            serveHtml('<html><head><title>Test Page</title></head></html>');

            const testText = 'Visit httpbin.org/html for testing';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
        });

        it('should return found false when no URL in text', async () => {
            const testText = 'This text has no URLs in it at all';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(false);
        });

        it('should handle empty text', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text parameter is required');
        });

        it('should handle text with only whitespace', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: '   \n\t  ' });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(false);
        });
    });
});
