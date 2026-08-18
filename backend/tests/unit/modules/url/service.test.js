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

describe('UrlService SSRF protections', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: PUBLIC_IP, family: 4 },
        ]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
    });

    it('does not follow a redirect that points at a private IP', async () => {
        // Persists across all calls (fetch channel + proxy fallback) - never
        // includes a request to the private target.
        global.fetch.mockResolvedValue({
            ok: false,
            status: 302,
            headers: {
                get: (name) =>
                    name.toLowerCase() === 'location'
                        ? 'http://169.254.169.254/latest/meta-data/'
                        : null,
            },
            text: async () => '',
        });

        mockHttpResponse(https, {
            statusCode: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        });

        const result = await urlService.getTitle('https://example.com/');

        // None of the requests actually made (fetch channel, proxy
        // fallback) ever target the malicious redirect destination.
        const requestedUrls = global.fetch.mock.calls.map((call) => call[0]);
        expect(
            requestedUrls.every((url) => !url.includes('169.254.169.254'))
        ).toBe(true);
        // The raw http/https fallback also refuses to follow the redirect -
        // it only ever issues the initial request.
        expect(https.request).toHaveBeenCalledTimes(1);
        expect(result.title).toBe(null);
    });

    it('follows a redirect to a public host and extracts its metadata', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 302,
            headers: {
                get: (name) =>
                    name.toLowerCase() === 'location'
                        ? 'https://example.com/landing'
                        : null,
            },
            text: async () => '',
        });
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            text: async () =>
                '<html><head><title>Landing Page</title></head></html>',
        });

        const result = await urlService.getTitle('https://example.com/');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(result.title).toBe('Landing Page');
    });
});
