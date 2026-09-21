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
                    signInLink: { windowMs: 60000, max: 4 },
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
    signInLinkLimiter,
    authLimiter,
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

describe('signInLinkLimiter', () => {
    const post = (app, ip) =>
        request(app).post('/ok').set('X-Forwarded-For', ip).send({});

    it('lets a household use several links before it says stop', async () => {
        const app = buildApp(signInLinkLimiter);
        const ip = nextIp();

        // Four requests are two devices (look, then sign in); the strict auth
        // limit in this suite allows only two requests in all.
        for (let i = 0; i < 4; i++) {
            await post(app, ip).expect(200);
        }
        const res = await post(app, ip).expect(429);
        expect(res.body.error).toBe('Too many sign-in link requests');
    });

    it('counts per IP', async () => {
        const app = buildApp(signInLinkLimiter);
        const first = nextIp();
        for (let i = 0; i < 5; i++) await post(app, first);

        const other = await post(app, nextIp());
        expect(other.status).toBe(200);
    });

    it('does not share its count with the auth limit, in either direction', async () => {
        const authApp = buildApp(authLimiter);
        const linkApp = buildApp(signInLinkLimiter);
        const ip = nextIp();

        await post(authApp, ip).expect(200);
        await post(authApp, ip).expect(200);
        expect((await post(authApp, ip)).status).toBe(429);

        await post(linkApp, ip).expect(200);
        await post(linkApp, ip).expect(200);
        await post(linkApp, ip).expect(200);
        await post(linkApp, ip).expect(200);
        await post(linkApp, ip).expect(429);
        await post(authApp, ip).expect(429);
    });
});

describe('the sign-in link routes', () => {
    const handlersOf = (path) => {
        const router = require('../../../modules/auth/routes');
        const layer = router.stack.find(
            (l) => l.route && l.route.path === path
        );
        return layer.route.stack.map((l) => l.handle);
    };

    it.each(['/sign-in-link/peek', '/sign-in-link/redeem'])(
        'limit %s with the sign-in link limiter and not the login one',
        (path) => {
            const handlers = handlersOf(path);

            expect(handlers).toContain(signInLinkLimiter);
            expect(handlers).not.toContain(authLimiter);
        }
    );
});
