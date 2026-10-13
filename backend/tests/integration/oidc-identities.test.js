const request = require('supertest');
const app = require('../../app');
const { OIDCIdentity, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const providerConfig = require('../../modules/oidc/providerConfig');

const signIn = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const linkIdentity = (user, providerSlug, subject) =>
    OIDCIdentity.create({
        user_id: user.id,
        provider_slug: providerSlug,
        subject,
        email: user.email,
    });

describe('Linked OIDC identities', () => {
    let alice, bob, aliceAgent;

    beforeEach(async () => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            OIDC_ENABLED: 'true',
            OIDC_PROVIDER_NAME: 'Test IdP',
            OIDC_PROVIDER_SLUG: 'test',
            OIDC_ISSUER_URL: 'https://id.example.com',
            OIDC_CLIENT_ID: 'client-id',
            OIDC_CLIENT_SECRET: 'client-secret',
        });
        providerConfig.reloadProviders();

        alice = await createTestUser({ email: 'alice@example.com' });
        bob = await createTestUser({ email: 'bob@example.com' });
        aliceAgent = await signIn(alice);
    });

    afterEach(() => {
        providerConfig.reloadProviders();
    });

    describe('GET /api/oidc/identities', () => {
        it('requires a signed-in user', async () => {
            const res = await request(app).get('/api/oidc/identities');

            expect(res.status).toBe(401);
        });

        it('lists only the caller identities', async () => {
            const mine = await linkIdentity(alice, 'test', 'alice-sub');
            await linkIdentity(bob, 'test', 'bob-sub');

            const res = await aliceAgent.get('/api/oidc/identities');

            expect(res.status).toBe(200);
            expect(res.body.identities.map((i) => i.id)).toEqual([mine.id]);
            expect(res.body.identities[0].provider_name).toBe('Test IdP');
        });
    });

    describe('DELETE /api/oidc/unlink/:identityId', () => {
        it('requires a signed-in user', async () => {
            const identity = await linkIdentity(alice, 'test', 'alice-sub');

            const res = await request(app).delete(
                `/api/oidc/unlink/${identity.id}`
            );

            expect(res.status).toBe(401);
            expect(await OIDCIdentity.findByPk(identity.id)).not.toBeNull();
        });

        it('unlinks the caller identity when a password remains', async () => {
            const identity = await linkIdentity(alice, 'test', 'alice-sub');

            const res = await aliceAgent.delete(
                `/api/oidc/unlink/${identity.id}`
            );

            expect(res.status).toBe(200);
            expect(await OIDCIdentity.findByPk(identity.id)).toBeNull();
        });

        it('does not unlink an identity that belongs to someone else', async () => {
            const identity = await linkIdentity(bob, 'test', 'bob-sub');

            const res = await aliceAgent.delete(
                `/api/oidc/unlink/${identity.id}`
            );

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Identity not found');
            expect(await OIDCIdentity.findByPk(identity.id)).not.toBeNull();
        });

        it('keeps the only sign-in method of an account without a password', async () => {
            const identity = await linkIdentity(alice, 'test', 'alice-sub');
            await User.update(
                { password_digest: null },
                { where: { id: alice.id } }
            );

            const res = await aliceAgent.delete(
                `/api/oidc/unlink/${identity.id}`
            );

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'This is your only authentication method'
            );
            expect(await OIDCIdentity.findByPk(identity.id)).not.toBeNull();
        });

        it('unlinks one of several identities on an account without a password', async () => {
            const first = await linkIdentity(alice, 'test', 'alice-sub-1');
            const second = await linkIdentity(alice, 'other', 'alice-sub-2');
            await User.update(
                { password_digest: null },
                { where: { id: alice.id } }
            );

            const res = await aliceAgent.delete(`/api/oidc/unlink/${first.id}`);

            expect(res.status).toBe(200);
            expect(await OIDCIdentity.findByPk(first.id)).toBeNull();
            expect(await OIDCIdentity.findByPk(second.id)).not.toBeNull();
        });

        it('answers 400 for an identity that does not exist', async () => {
            const res = await aliceAgent.delete('/api/oidc/unlink/999999');

            expect(res.status).toBe(400);
        });
    });
});
