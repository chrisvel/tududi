jest.mock('../../config/config', () => {
    const actual = jest.requireActual('../../config/config');
    return {
        ...actual,
        getConfig: () => {
            const config = actual.getConfig();
            return {
                ...config,
                rateLimiting: {
                    ...config.rateLimiting,
                    enabled: true,
                    api: { windowMs: 60000, max: 1000 },
                },
            };
        },
    };
});

const request = require('supertest');
const app = require('../../app');

describe('rate limiting is mounted on every API base path', () => {
    it.each(['/api', '/api/v1'])(
        'applies the general limiter under %s',
        async (base) => {
            // The limiter runs before route auth, so the header is present
            // whether or not the route itself needs a login.
            const response = await request(app).get(`${base}/version`);

            expect(response.headers['ratelimit-limit']).toBe('1000');
        }
    );
});
