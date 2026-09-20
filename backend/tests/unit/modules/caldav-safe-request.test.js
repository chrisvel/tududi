let mockAllowPrivate = false;

jest.mock('../../../config/config', () => {
    const actual = jest.requireActual('../../../config/config');
    return {
        ...actual,
        getConfig: () => ({
            ...actual.getConfig(),
            caldav: {
                get allowPrivateHosts() {
                    return mockAllowPrivate;
                },
            },
        }),
    };
});
jest.mock('axios');

const axios = require('axios');
const {
    assertSafeCalDavUrl,
    safeRequest,
    guardedLookup,
} = require('../../../modules/caldav/services/safe-request');

const PUBLIC_A = 'https://93.184.216.34/dav/';
const PUBLIC_B = 'https://198.51.101.7/dav/';

beforeEach(() => {
    mockAllowPrivate = false;
    axios.mockReset();
});

describe('assertSafeCalDavUrl', () => {
    it.each([
        'https://127.0.0.1/dav/',
        'https://127.0.0.2/dav/',
        'https://0.0.0.0/dav/',
        'https://10.1.2.3/dav/',
        'https://172.20.0.5/dav/',
        'https://192.168.1.10/dav/',
        'https://169.254.169.254/latest/meta-data/',
        'https://100.64.0.1/dav/',
        'https://[::1]/dav/',
        'https://[::ffff:7f00:1]/dav/',
        'https://[fe80::1]/dav/',
        'https://[fd00::1]/dav/',
    ])('refuses %s', async (url) => {
        await expect(assertSafeCalDavUrl(url)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('private, local, or internal'),
        });
    });

    it('refuses a hostname that resolves to a loopback address', async () => {
        await expect(
            assertSafeCalDavUrl('https://localhost/dav/')
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts a public address on any port', async () => {
        const parsed = await assertSafeCalDavUrl(
            'https://93.184.216.34:8443/dav/'
        );
        expect(parsed.port).toBe('8443');
    });

    it('requires https for a new calendar but not for an existing sync', async () => {
        await expect(
            assertSafeCalDavUrl('http://93.184.216.34/dav/', {
                requireHttps: true,
            })
        ).rejects.toMatchObject({ message: expect.stringContaining('HTTPS') });

        await expect(
            assertSafeCalDavUrl('http://93.184.216.34/dav/')
        ).resolves.toBeDefined();
    });

    it('rejects other protocols and malformed urls', async () => {
        await expect(
            assertSafeCalDavUrl('ftp://93.184.216.34/')
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(assertSafeCalDavUrl('not a url')).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it('allows private hosts and plain http when the operator opts in', async () => {
        mockAllowPrivate = true;

        await expect(
            assertSafeCalDavUrl('http://192.168.1.10:5232/dav/', {
                requireHttps: true,
            })
        ).resolves.toBeDefined();
    });
});

describe('safeRequest', () => {
    it('sends the request with redirects disabled and the guarded agents', async () => {
        axios.mockResolvedValueOnce({ status: 207, data: '<xml/>' });

        const response = await safeRequest({
            method: 'REPORT',
            url: PUBLIC_A,
            auth: { username: 'u', password: 'p' },
        });

        expect(response.status).toBe(207);
        expect(axios).toHaveBeenCalledTimes(1);
        const sent = axios.mock.calls[0][0];
        expect(sent.maxRedirects).toBe(0);
        expect(sent.httpAgent).toBeDefined();
        expect(sent.httpsAgent).toBeDefined();
        expect(sent.method).toBe('REPORT');
    });

    it('refuses to send anything to a private address', async () => {
        await expect(
            safeRequest({ method: 'GET', url: 'https://10.0.0.5/dav/' })
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(axios).not.toHaveBeenCalled();
    });

    it('refuses a redirect that points at a private address', async () => {
        axios.mockResolvedValueOnce({
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        });

        await expect(
            safeRequest({ method: 'GET', url: PUBLIC_A })
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(axios).toHaveBeenCalledTimes(1);
    });

    it('follows a redirect on the same origin and keeps the method and body', async () => {
        axios
            .mockResolvedValueOnce({
                status: 308,
                headers: { location: '/dav/calendars/' },
            })
            .mockResolvedValueOnce({ status: 207, data: '<ok/>' });

        const response = await safeRequest({
            method: 'REPORT',
            url: PUBLIC_A,
            data: '<body/>',
            auth: { username: 'u', password: 'p' },
        });

        expect(response.status).toBe(207);
        const second = axios.mock.calls[1][0];
        expect(second.url).toBe('https://93.184.216.34/dav/calendars/');
        expect(second.method).toBe('REPORT');
        expect(second.data).toBe('<body/>');
        expect(second.auth).toEqual({ username: 'u', password: 'p' });
    });

    it('does not forward credentials to a different origin', async () => {
        axios
            .mockResolvedValueOnce({
                status: 301,
                headers: { location: PUBLIC_B },
            })
            .mockResolvedValueOnce({ status: 200, data: 'ok' });

        await safeRequest({
            method: 'GET',
            url: PUBLIC_A,
            auth: { username: 'u', password: 'p' },
            headers: { Authorization: 'Bearer secret', Accept: 'text/xml' },
        });

        const second = axios.mock.calls[1][0];
        expect(second.url).toBe(PUBLIC_B);
        expect(second.auth).toBeUndefined();
        expect(second.headers).toEqual({ Accept: 'text/xml' });
    });

    it('turns a 303 into a body-less GET', async () => {
        axios
            .mockResolvedValueOnce({
                status: 303,
                headers: { location: '/done' },
            })
            .mockResolvedValueOnce({ status: 200, data: 'ok' });

        await safeRequest({ method: 'POST', url: PUBLIC_A, data: 'payload' });

        const second = axios.mock.calls[1][0];
        expect(second.method).toBe('GET');
        expect(second.data).toBeUndefined();
    });

    it('gives up after too many redirects', async () => {
        axios.mockResolvedValue({
            status: 302,
            headers: { location: '/loop' },
        });

        await expect(
            safeRequest({ method: 'GET', url: PUBLIC_A })
        ).rejects.toMatchObject({ statusCode: 502 });
        expect(axios).toHaveBeenCalledTimes(6);
    });

    it('rejects a redirect with no location header', async () => {
        axios.mockResolvedValueOnce({ status: 302, headers: {} });

        await expect(
            safeRequest({ method: 'GET', url: PUBLIC_A })
        ).rejects.toMatchObject({ statusCode: 502 });
    });

    it('still lets the caller decide which statuses are errors', async () => {
        axios.mockImplementationOnce(async (config) => {
            expect(config.validateStatus(207)).toBe(true);
            expect(config.validateStatus(404)).toBe(false);
            expect(config.validateStatus(302)).toBe(true);
            return { status: 207 };
        });

        await safeRequest({
            method: 'REPORT',
            url: PUBLIC_A,
            validateStatus: (status) => status === 207,
        });
        expect(axios).toHaveBeenCalledTimes(1);
    });
});

describe('guardedLookup', () => {
    const lookup = (hostname, options) =>
        new Promise((resolve) => {
            guardedLookup(hostname, options, (error, ...rest) =>
                resolve({ error, rest })
            );
        });

    it('refuses to connect to a name that resolves to loopback', async () => {
        const { error } = await lookup('localhost', {});

        expect(error).toBeDefined();
        expect(error.statusCode).toBe(400);
    });

    it('returns loopback addresses when the operator opts in', async () => {
        mockAllowPrivate = true;

        const { error, rest } = await lookup('localhost', { all: true });

        expect(error).toBeNull();
        expect(Array.isArray(rest[0])).toBe(true);
        expect(rest[0].length).toBeGreaterThan(0);
    });
});
