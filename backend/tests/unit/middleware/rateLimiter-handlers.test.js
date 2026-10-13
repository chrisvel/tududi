jest.mock('../../../config/config', () => {
    const actual = jest.requireActual('../../../config/config');
    return {
        ...actual,
        getConfig: () => {
            const config = actual.getConfig();
            return {
                ...config,
                rateLimiting: {
                    ...config.rateLimiting,
                    enabled: true,
                    auth: { windowMs: 60000, max: 1 },
                    authEmail: { windowMs: 60000, max: 1 },
                    createResource: { windowMs: 60000, max: 1 },
                    apiKeyManagement: { windowMs: 60000, max: 1 },
                    uploads: { windowMs: 60000, max: 1 },
                },
            };
        },
    };
});

const express = require('express');
const request = require('supertest');
const {
    oidcLimiter,
    authEmailLimiter,
    createResourceLimiter,
    apiKeyManagementLimiter,
    uploadsLimiter,
} = require('../../../middleware/rateLimiter');

let ipCounter = 0;
const nextIp = () => `10.1.0.${++ipCounter}`;

const buildApp = (limiter, status = 200) => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(limiter);
    app.all('/x', (req, res) => res.status(status).json({ ok: status < 400 }));
    return app;
};

// The 429 answer of every limiter that the main rate limiter tests do not
// push over its limit.
describe('rate limiter answers once the limit is reached', () => {
    it.each([
        ['oidcLimiter', oidcLimiter, 401, 'Too many authentication attempts'],
        [
            'authEmailLimiter',
            authEmailLimiter,
            200,
            'Too many authentication attempts',
        ],
        [
            'createResourceLimiter',
            createResourceLimiter,
            200,
            'Rate limit exceeded',
        ],
        [
            'apiKeyManagementLimiter',
            apiKeyManagementLimiter,
            200,
            'Rate limit exceeded',
        ],
        ['uploadsLimiter', uploadsLimiter, 200, 'Rate limit exceeded'],
    ])('%s', async (name, limiter, status, error) => {
        const app = buildApp(limiter, status);
        const ip = nextIp();
        const send = () =>
            request(app)
                .post('/x')
                .set('X-Forwarded-For', ip)
                .send({ email: `${name}@example.com` });

        await send();
        const limited = await send();

        expect(limited.status).toBe(429);
        expect(limited.body.error).toBe(error);
        expect(typeof limited.body.retryAfter).toBe('number');
    });
});
