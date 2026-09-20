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
                    auth: { windowMs: 60000, max: 2 },
                    api: { windowMs: 60000, max: 2 },
                    authenticatedApi: { windowMs: 60000, max: 3 },
                    bearerFailure: { max: 2 },
                    passwordConfirm: { windowMs: 60000, max: 2 },
                },
            };
        },
    };
});

const express = require('express');
const request = require('supertest');
const {
    apiLimiter,
    authenticatedApiLimiter,
    bearerFailureLimiter,
    passwordConfirmLimiter,
    loginLimiter,
    requestIdentity,
} = require('../../../middleware/rateLimiter');

let ipCounter = 0;
const nextIp = () => `10.0.0.${++ipCounter}`;

const buildApp = (...limiters) => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use((req, res, next) => {
        if (req.headers['x-test-user']) {
            req.session = { userId: Number(req.headers['x-test-user']) };
        }
        next();
    });
    limiters.forEach((limiter) => app.use(limiter));
    app.all('/ok', (req, res) => res.json({ ok: true }));
    app.all('/protected', (req, res) => {
        if (req.headers.authorization === 'Bearer good-token') {
            return res.json({ ok: true });
        }
        return res.status(401).json({ error: 'nope' });
    });
    app.post('/login', (req, res) => {
        if (req.body.password === 'right') return res.json({ ok: true });
        return res.status(401).json({ error: 'bad credentials' });
    });
    return app;
};

describe('requestIdentity', () => {
    it('prefers a resolved user, then the session, then a hashed bearer token', () => {
        expect(
            requestIdentity({
                currentUser: { id: 4 },
                session: { userId: 9 },
                headers: {},
            })
        ).toBe('user:4');
        expect(requestIdentity({ session: { userId: 9 }, headers: {} })).toBe(
            'user:9'
        );

        const identity = requestIdentity({
            headers: { authorization: 'Bearer tt_secret' },
        });
        expect(identity).toMatch(/^token:[0-9a-f]{32}$/);
        expect(identity).not.toContain('tt_secret');
    });

    it('returns null for anonymous requests', () => {
        expect(requestIdentity({ headers: {} })).toBeNull();
        expect(
            requestIdentity({ headers: { authorization: 'Basic abc' } })
        ).toBeNull();
    });
});

describe('general API limiters', () => {
    it('limits anonymous callers per IP', async () => {
        const app = buildApp(apiLimiter, authenticatedApiLimiter);
        const ip = nextIp();

        await request(app).get('/ok').set('X-Forwarded-For', ip).expect(200);
        await request(app).get('/ok').set('X-Forwarded-For', ip).expect(200);
        await request(app).get('/ok').set('X-Forwarded-For', ip).expect(429);
    });

    it('limits a session user by identity, not by IP', async () => {
        const app = buildApp(apiLimiter, authenticatedApiLimiter);
        const ip = nextIp();

        for (let i = 0; i < 3; i++) {
            await request(app)
                .get('/ok')
                .set('X-Forwarded-For', ip)
                .set('X-Test-User', '11')
                .expect(200);
        }
        await request(app)
            .get('/ok')
            .set('X-Forwarded-For', ip)
            .set('X-Test-User', '11')
            .expect(429);

        await request(app)
            .get('/ok')
            .set('X-Forwarded-For', ip)
            .set('X-Test-User', '12')
            .expect(200);
    });

    it('gives each bearer token its own budget instead of the anonymous IP one', async () => {
        const app = buildApp(apiLimiter, authenticatedApiLimiter);
        const ip = nextIp();

        for (let i = 0; i < 3; i++) {
            await request(app)
                .get('/ok')
                .set('X-Forwarded-For', ip)
                .set('Authorization', 'Bearer tt_one')
                .expect(200);
        }
        await request(app)
            .get('/ok')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer tt_one')
            .expect(429);
        await request(app)
            .get('/ok')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer tt_two')
            .expect(200);
    });
});

describe('bearerFailureLimiter', () => {
    it('throttles repeated invalid tokens but never counts valid ones', async () => {
        const app = buildApp(bearerFailureLimiter);
        const ip = nextIp();

        for (let i = 0; i < 5; i++) {
            await request(app)
                .get('/protected')
                .set('X-Forwarded-For', ip)
                .set('Authorization', 'Bearer good-token')
                .expect(200);
        }

        await request(app)
            .get('/protected')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer bad-1')
            .expect(401);
        await request(app)
            .get('/protected')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer bad-2')
            .expect(401);
        await request(app)
            .get('/protected')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer bad-3')
            .expect(429);
    });

    it('ignores requests without a bearer credential and browser sessions', async () => {
        const app = buildApp(bearerFailureLimiter);
        const ip = nextIp();

        for (let i = 0; i < 4; i++) {
            await request(app)
                .get('/protected')
                .set('X-Forwarded-For', ip)
                .expect(401);
            await request(app)
                .get('/protected')
                .set('X-Forwarded-For', ip)
                .set('X-Test-User', '5')
                .set('Authorization', 'Bearer bad')
                .expect(401);
        }
    });
});

describe('passwordConfirmLimiter', () => {
    it('only counts requests that submit a password', async () => {
        const app = buildApp(passwordConfirmLimiter);
        const ip = nextIp();

        for (let i = 0; i < 5; i++) {
            await request(app)
                .post('/ok')
                .set('X-Forwarded-For', ip)
                .set('X-Test-User', '21')
                .send({ appearance: 'dark' })
                .expect(200);
        }

        const attempt = () =>
            request(app)
                .post('/ok')
                .set('X-Forwarded-For', ip)
                .set('X-Test-User', '21')
                .send({ currentPassword: 'guess', newPassword: 'x' });

        await attempt().expect(200);
        await attempt().expect(200);
        await attempt().expect(429);
    });
});

describe('loginLimiter', () => {
    it('counts only failed logins', async () => {
        const app = buildApp(loginLimiter);
        const ip = nextIp();

        for (let i = 0; i < 5; i++) {
            await request(app)
                .post('/login')
                .set('X-Forwarded-For', ip)
                .send({ password: 'right' })
                .expect(200);
        }

        await request(app)
            .post('/login')
            .set('X-Forwarded-For', ip)
            .send({ password: 'wrong' })
            .expect(401);
        await request(app)
            .post('/login')
            .set('X-Forwarded-For', ip)
            .send({ password: 'wrong' })
            .expect(401);
        await request(app)
            .post('/login')
            .set('X-Forwarded-For', ip)
            .send({ password: 'wrong' })
            .expect(429);
    });
});
