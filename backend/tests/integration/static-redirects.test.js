const http = require('http');
const app = require('../../app');

// Raw requests, so the client sends the path exactly as written instead of
// normalizing backslashes or dot segments first.
const rawGet = (server, path) =>
    new Promise((resolve, reject) => {
        const { port } = server.address();
        const req = http.request(
            { host: '127.0.0.1', port, path, method: 'GET' },
            (res) => {
                res.resume();
                res.on('end', () => resolve(res));
            }
        );
        req.on('error', reject);
        req.end();
    });

describe('Static file redirects (GHSA-m2j3-rgfr-57pq)', () => {
    let server;

    beforeAll(
        () =>
            new Promise((resolve) => {
                server = app.listen(0, '127.0.0.1', resolve);
            })
    );

    afterAll(() => new Promise((resolve) => server.close(resolve)));

    it.each([
        '/\\attacker.example/%2f..',
        '/%5cattacker.example/%2f..',
        '/%5Cattacker.example/%2f..',
        '/\\/attacker.example/',
        '/locales/\\attacker.example/%2f..',
        '/api/uploads/\\attacker.example/%2f..',
    ])('rejects backslash path %s without redirecting', async (path) => {
        const res = await rawGet(server, path);
        expect(res.statusCode).toBe(400);
        expect(res.headers.location).toBeUndefined();
    });

    it('does not redirect a directory path to add a trailing slash', async () => {
        const res = await rawGet(server, '/locales');
        expect(res.statusCode).not.toBe(301);
        expect(res.headers.location).toBeUndefined();
    });

    it('does not redirect encoded dot segments', async () => {
        const res = await rawGet(server, '/locales/en/%2f..');
        expect(res.statusCode).not.toBe(301);
        expect(res.headers.location).toBeUndefined();
    });

    it('still allows backslashes in the query string', async () => {
        const res = await rawGet(server, '/api/health?q=%5C');
        expect(res.statusCode).toBe(200);
    });
});
