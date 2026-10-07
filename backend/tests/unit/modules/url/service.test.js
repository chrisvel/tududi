const dns = require('dns');
const EventEmitter = require('events');

jest.mock('http', () => ({ request: jest.fn() }));
jest.mock('https', () => ({ request: jest.fn() }));

const https = require('https');
const urlService = require('../../../../modules/url/service');

// Public IP - stands in for any hostname the tests use so DNS resolution
// never depends on real network access.
const PUBLIC_IP = '93.184.216.34';

function mockHttpResponse(mod, { statusCode, headers = {}, body = '' }) {
    mod.request.mockImplementationOnce((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = statusCode;
        res.headers = headers;
        res.resume = jest.fn();
        res.destroy = jest.fn();
        callback(res);
        if (body) {
            process.nextTick(() => res.emit('data', Buffer.from(body)));
        }
        process.nextTick(() => res.emit('end'));

        const req = new EventEmitter();
        req.end = jest.fn();
        return req;
    });
}

const { publicOnlyLookup } = require('../../../../modules/url/ssrfGuard');

describe('UrlService SSRF protections', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Only the third-party proxy fallback still uses fetch.
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            headers: { get: () => null },
            text: async () => '',
        });
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: PUBLIC_IP, family: 4 },
        ]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
    });

    it('does not follow a redirect that points at a private IP', async () => {
        mockHttpResponse(https, {
            statusCode: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        });

        const result = await urlService.getTitle('https://example.com/');

        // Only the initial request is made; the private hop is refused.
        expect(https.request).toHaveBeenCalledTimes(1);
        const fetched = global.fetch.mock.calls.map((call) => call[0]);
        expect(fetched.every((url) => !url.includes('169.254.169.254'))).toBe(
            true
        );
        expect(result.title).toBe(null);
    });

    it('follows a redirect to a public host and extracts its metadata', async () => {
        mockHttpResponse(https, {
            statusCode: 302,
            headers: { location: 'https://example.com/landing' },
        });
        mockHttpResponse(https, {
            statusCode: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
            body: '<html><head><title>Landing Page</title></head></html>',
        });

        const result = await urlService.getTitle('https://example.com/');

        expect(https.request).toHaveBeenCalledTimes(2);
        expect(result.title).toBe('Landing Page');
    });

    it('pins every connection to a public address at connect time', async () => {
        mockHttpResponse(https, {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><head><title>Pinned</title></head></html>',
        });

        await urlService.getTitle('https://example.com/');

        const [options] = https.request.mock.calls[0];
        expect(options.lookup).toBe(publicOnlyLookup);
    });

    it('ignores a response that is not HTML', async () => {
        mockHttpResponse(https, {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: '{"title":"not a page"}',
        });

        const result = await urlService.getTitle('https://example.com/');
        expect(result.title).toBe(null);
    });
});
