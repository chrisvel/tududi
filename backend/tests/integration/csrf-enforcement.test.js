const request = require('supertest');
const app = require('../../app');
const { Area } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { createApiToken } = require('../../modules/users/apiTokenService');

// The app skips its CSRF check under NODE_ENV=test, so each test here runs
// the requests as development to exercise the real middleware.
describe('CSRF protection on the running app', () => {
    let user;

    beforeEach(async () => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            NODE_ENV: 'development',
        });
        user = await createTestUser({ email: 'csrf@example.com' });
    });

    const signIn = async () => {
        const agent = request.agent(app);
        const login = await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        expect(login.status).toBe(200);
        return agent;
    };

    const csrfToken = async (agent) => {
        const res = await agent.get('/api/csrf-token');
        expect(res.status).toBe(200);
        expect(res.body.csrfToken).toBeTruthy();
        return res.body.csrfToken;
    };

    it('lets an anonymous login through without a token', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });

        expect(res.status).toBe(200);
    });

    it('rejects a signed-in write without a token', async () => {
        const agent = await signIn();

        const res = await agent.post('/api/areas').send({ name: 'No token' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_ERROR');
        expect(await Area.count({ where: { user_id: user.id } })).toBe(0);
    });

    it('rejects a signed-in write with a wrong token', async () => {
        const agent = await signIn();
        await csrfToken(agent);

        const res = await agent
            .post('/api/areas')
            .set('x-csrf-token', 'not-the-token')
            .send({ name: 'Wrong token' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('CSRF_ERROR');
    });

    it('rejects a token issued to a different session', async () => {
        const other = await signIn();
        const stolen = await csrfToken(other);
        const agent = await signIn();

        const res = await agent
            .post('/api/areas')
            .set('x-csrf-token', stolen)
            .send({ name: 'Other session token' });

        expect(res.status).toBe(403);
    });

    it.each(['put', 'patch', 'delete'])(
        'rejects a signed-in %s without a token',
        async (method) => {
            const agent = await signIn();
            const area = await Area.create({
                name: 'Existing',
                user_id: user.id,
            });

            const res = await agent[method](`/api/areas/${area.uid}`).send({
                name: 'Renamed',
            });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('CSRF_ERROR');
        }
    );

    it('accepts a signed-in write with the session token', async () => {
        const agent = await signIn();
        const token = await csrfToken(agent);

        const res = await agent
            .post('/api/areas')
            .set('x-csrf-token', token)
            .send({ name: 'With token' });

        expect(res.status).toBe(201);
    });

    it('does not require a token for reads', async () => {
        const agent = await signIn();

        const res = await agent.get('/api/areas');

        expect(res.status).toBe(200);
    });

    it('does not require a token for API token requests', async () => {
        const { rawToken } = await createApiToken({ userId: user.id });

        const res = await request(app)
            .post('/api/areas')
            .set('Authorization', `Bearer ${rawToken}`)
            .send({ name: 'From automation' });

        expect(res.status).toBe(201);
    });
});
