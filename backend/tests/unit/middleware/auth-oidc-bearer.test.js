jest.mock('../../../modules/oidc/service', () => ({
    ...jest.requireActual('../../../modules/oidc/service'),
    validateAccessToken: jest.fn(),
}));

const { requireAuth } = require('../../../middleware/auth');
const { validateAccessToken } = require('../../../modules/oidc/service');
const providerConfig = require('../../../modules/oidc/providerConfig');
const { OIDCIdentity } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

// Two providers can hand out the same subject, so a token is only matched to
// an identity from the provider that issued it.
describe('Auth middleware: OIDC access tokens', () => {
    let req, res, next, alice, bob;

    beforeEach(async () => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            OIDC_ENABLED: 'true',
            OIDC_PROVIDER_1_NAME: 'Company',
            OIDC_PROVIDER_1_SLUG: 'company',
            OIDC_PROVIDER_1_ISSUER: 'https://id.company.example',
            OIDC_PROVIDER_1_CLIENT_ID: 'company-client',
            OIDC_PROVIDER_1_CLIENT_SECRET: 'company-secret',
            OIDC_PROVIDER_2_NAME: 'Public',
            OIDC_PROVIDER_2_SLUG: 'public',
            OIDC_PROVIDER_2_ISSUER: 'https://id.public.example/',
            OIDC_PROVIDER_2_CLIENT_ID: 'public-client',
            OIDC_PROVIDER_2_CLIENT_SECRET: 'public-secret',
        });
        providerConfig.reloadProviders();

        alice = await createTestUser({ email: 'alice@example.com' });
        bob = await createTestUser({ email: 'bob@example.com' });
        await OIDCIdentity.create({
            user_id: alice.id,
            provider_slug: 'company',
            subject: 'shared-subject',
        });
        await OIDCIdentity.create({
            user_id: bob.id,
            provider_slug: 'public',
            subject: 'shared-subject',
        });

        req = {
            path: '/api/tasks',
            session: {},
            headers: { authorization: 'Bearer eyJhbGciOi.jwt.token' },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            set: jest.fn(),
        };
        next = jest.fn();
    });

    afterEach(() => {
        providerConfig.reloadProviders();
    });

    it('signs in the user linked at the provider that issued the token', async () => {
        validateAccessToken.mockResolvedValue({
            sub: 'shared-subject',
            iss: 'https://id.company.example',
        });

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.currentUser.id).toBe(alice.id);
    });

    it('signs in the other provider user when that provider issued the token', async () => {
        validateAccessToken.mockResolvedValue({
            sub: 'shared-subject',
            iss: 'https://id.public.example',
        });

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.currentUser.id).toBe(bob.id);
    });

    it('ignores a trailing slash when matching the issuer', async () => {
        validateAccessToken.mockResolvedValue({
            sub: 'shared-subject',
            iss: 'https://id.company.example/',
        });

        await requireAuth(req, res, next);

        expect(req.currentUser.id).toBe(alice.id);
    });

    it('rejects a token from an issuer that is not configured', async () => {
        validateAccessToken.mockResolvedValue({
            sub: 'shared-subject',
            iss: 'https://evil.example',
        });

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(req.currentUser).toBeUndefined();
    });

    it('rejects a subject that is only linked at a different provider', async () => {
        await OIDCIdentity.create({
            user_id: alice.id,
            provider_slug: 'company',
            subject: 'company-only',
        });
        validateAccessToken.mockResolvedValue({
            sub: 'company-only',
            iss: 'https://id.public.example',
        });

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects a token that fails validation', async () => {
        validateAccessToken.mockRejectedValue(new Error('signature invalid'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid or expired access token',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('does not try JWT validation when OIDC is disabled', async () => {
        process.env.OIDC_ENABLED = 'false';

        await requireAuth(req, res, next);

        expect(validateAccessToken).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
