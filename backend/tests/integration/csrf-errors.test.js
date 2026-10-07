const express = require('express');
const session = require('express-session');
const lusca = require('lusca');
const request = require('supertest');
const errorHandler = require('../../shared/middleware/errorHandler');

// The real CSRF middleware in front of the real error handler, since the app
// itself skips CSRF when running tests.
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use(
        session({ secret: 'test', resave: false, saveUninitialized: true })
    );
    app.use(lusca.csrf({ header: 'x-csrf-token', cookie: false }));
    app.get('/token', (req, res) => res.json({ token: req.csrfToken() }));
    app.post('/change', (req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    return app;
};

describe('CSRF failures', () => {
    it('answers 403 when the token is missing', async () => {
        const agent = request.agent(buildApp());
        await agent.get('/token');

        const res = await agent.post('/change').send({});

        expect(res.status).toBe(403);
        expect(res.body).toEqual({
            error: 'CSRF token missing',
            code: 'CSRF_ERROR',
        });
    });

    it('answers 403 when the token is wrong', async () => {
        const agent = request.agent(buildApp());
        await agent.get('/token');

        const res = await agent
            .post('/change')
            .set('x-csrf-token', 'not-the-token')
            .send({});

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_ERROR');
    });

    it('lets a request with the right token through', async () => {
        const agent = request.agent(buildApp());
        const { body } = await agent.get('/token');

        const res = await agent
            .post('/change')
            .set('x-csrf-token', body.token)
            .send({});

        expect(res.status).toBe(200);
    });
});
