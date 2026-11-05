jest.mock('../../config/config', () => {
    const actual = jest.requireActual('../../config/config');
    return {
        ...actual,
        getConfig: () => {
            const config = actual.getConfig();
            return {
                ...config,
                trustProxy: 1,
                rateLimiting: {
                    ...config.rateLimiting,
                    enabled: true,
                    api: { windowMs: 15 * 60 * 1000, max: 3 },
                },
            };
        },
    };
});

const request = require('supertest');
const app = require('../../app');

let ipCounter = 0;
const nextIp = () => `10.20.0.${++ipCounter}`;

// The sign-in page loads these before anyone signs in (#2015).
const signInPagePaths = [
    '/current_user',
    '/feature-flags',
    '/registration-status',
    '/oidc/providers',
    '/password-auth-status',
    '/config',
    '/version',
];

describe('anonymous limit and the sign-in page', () => {
    it('does not count sign-in page loads under /api or /api/v1', async () => {
        const ip = nextIp();

        // More sign-in page loads than the anonymous budget of 3 allows
        for (const base of ['/api', '/api/v1']) {
            for (const path of signInPagePaths) {
                const response = await request(app)
                    .get(`${base}${path}`)
                    .set('X-Forwarded-For', ip);
                expect(response.status).not.toBe(429);
            }
        }

        // Other anonymous requests still use up the budget
        for (let i = 0; i < 3; i++) {
            const response = await request(app)
                .get('/api/tasks')
                .set('X-Forwarded-For', ip);
            expect(response.status).not.toBe(429);
        }
        const limited = await request(app)
            .get('/api/tasks')
            .set('X-Forwarded-For', ip);
        expect(limited.status).toBe(429);
    });

    it('still caps sign-in page loads at ten times the anonymous budget', async () => {
        const ip = nextIp();
        const statuses = [];
        for (let i = 0; i < 31; i++) {
            const response = await request(app)
                .get('/api/version')
                .set('X-Forwarded-For', ip);
            statuses.push(response.status);
        }
        expect(statuses.slice(0, 30)).not.toContain(429);
        expect(statuses[30]).toBe(429);
    });

    it('still counts other methods on the same paths', async () => {
        const ip = nextIp();
        const statuses = [];
        for (let i = 0; i < 4; i++) {
            const response = await request(app)
                .post('/api/version')
                .set('X-Forwarded-For', ip);
            statuses.push(response.status);
        }
        expect(statuses[3]).toBe(429);
    });

    it('answers 429 with the seconds left to wait', async () => {
        const ip = nextIp();
        let limited;
        for (let i = 0; i < 4; i++) {
            limited = await request(app)
                .get('/api/tasks')
                .set('X-Forwarded-For', ip);
        }

        expect(limited.status).toBe(429);
        expect(limited.body.retryAfter).toBeGreaterThan(0);
        expect(limited.body.retryAfter).toBeLessThanOrEqual(15 * 60);
    });
});
