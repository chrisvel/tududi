jest.mock('../../../../modules/oidc/service', () => ({
    initiateAuthFlow: jest.fn(),
    handleCallback: jest.fn(),
}));
jest.mock('../../../../modules/oidc/provisioningService', () => ({
    provisionUser: jest.fn(),
    linkIdentityToUser: jest.fn(),
}));
jest.mock('../../../../modules/oidc/oidcIdentityService', () => ({
    canUnlink: jest.fn(),
    getIdentityById: jest.fn(),
    unlinkIdentity: jest.fn(),
    getUserIdentities: jest.fn(),
}));
jest.mock('../../../../modules/oidc/providerConfig', () => ({
    getAllProviders: jest.fn(),
}));
jest.mock('../../../../modules/oidc/auditService', () => ({
    AUTH_METHODS: { OIDC: 'oidc' },
    logOidcLinked: jest.fn(),
    logOidcProvision: jest.fn(),
    logLoginSuccess: jest.fn(),
    logLoginFailed: jest.fn(),
    logOidcUnlinked: jest.fn(),
}));

const controller = require('../../../../modules/oidc/controller');
const oidcService = require('../../../../modules/oidc/service');
const provisioningService = require('../../../../modules/oidc/provisioningService');
const identities = require('../../../../modules/oidc/oidcIdentityService');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const { User } = require('../../../../models');

const response = () => {
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(() => res),
        redirect: jest.fn(),
        cookie: jest.fn(),
        clearCookie: jest.fn(),
    };
    return res;
};

// The single sign-on controller on the paths the flow tests do not take:
// odd cookies, link callbacks without a session or user, sessions that fail
// to save, and every handler's own error answer.
describe('OIDC controller edge cases', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('listProviders', () => {
        it('lists the public part of each provider', async () => {
            providerConfig.getAllProviders.mockResolvedValue([
                { slug: 'google', name: 'Google', clientSecret: 'x' },
            ]);
            const res = response();

            await controller.listProviders({}, res);

            expect(res.json).toHaveBeenCalledWith({
                providers: [{ slug: 'google', name: 'Google', type: 'oidc' }],
            });
        });

        it('answers 500 when providers cannot be read', async () => {
            providerConfig.getAllProviders.mockRejectedValue(new Error('x'));
            const res = response();

            await controller.listProviders({}, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    it('sends the browser back to login when a flow cannot start', async () => {
        oidcService.initiateAuthFlow.mockRejectedValue(new Error('down'));
        const res = response();

        await controller.initiateAuth({ params: { slug: 'google' } }, res);

        expect(res.redirect).toHaveBeenCalledWith(
            expect.stringMatching(/^\/login\?error=/)
        );
    });

    describe('handleCallback', () => {
        const callbackReq = (extra = {}) => ({
            params: { slug: 'google' },
            query: { state: 's' },
            headers: {},
            ...extra,
        });

        it('reads the binding cookie among others, ignoring broken ones', async () => {
            oidcService.handleCallback.mockRejectedValue(new Error('stop'));

            await controller.handleCallback(
                callbackReq({
                    headers: {
                        cookie: 'flag; other=1; oidc_binding=%E0%A4%A',
                    },
                }),
                response()
            );

            expect(oidcService.handleCallback).toHaveBeenCalledWith(
                'google',
                { state: 's' },
                null
            );
        });

        it('asks a link callback without a session to sign in', async () => {
            oidcService.handleCallback.mockResolvedValue({
                linkMode: true,
                linkUserId: 1,
            });
            const res = response();

            await controller.handleCallback(callbackReq(), res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringMatching(/Authentication%20required/)
            );
        });

        it('asks a link callback whose user is gone to sign in', async () => {
            oidcService.handleCallback.mockResolvedValue({
                linkMode: true,
                linkUserId: 5,
            });
            jest.spyOn(User, 'findByPk').mockResolvedValue(null);
            const res = response();

            await controller.handleCallback(
                callbackReq({ session: { userId: 5 } }),
                res
            );

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringMatching(/Authentication%20required/)
            );
            expect(
                provisioningService.linkIdentityToUser
            ).not.toHaveBeenCalled();
        });

        it('reports a session that cannot be saved after sign-in', async () => {
            oidcService.handleCallback.mockResolvedValue({
                linkMode: false,
                claims: {},
            });
            provisioningService.provisionUser.mockResolvedValue({
                user: { id: 3 },
                isNewUser: false,
            });
            const res = response();

            await controller.handleCallback(
                callbackReq({
                    session: { save: (cb) => cb(new Error('store down')) },
                }),
                res
            );

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringMatching(/Failed%20to%20establish%20session/)
            );
        });
    });

    describe('signed-in handlers', () => {
        it.each(['initiateLink', 'unlinkIdentity', 'getUserIdentities'])(
            '%s needs a signed-in user',
            async (handler) => {
                const res = response();
                await controller[handler]({ params: {} }, res);
                expect(res.status).toHaveBeenCalledWith(401);
            }
        );

        it('answers 500 when a link flow cannot start', async () => {
            oidcService.initiateAuthFlow.mockRejectedValue(new Error('down'));
            const res = response();

            await controller.initiateLink(
                { params: { slug: 'google' }, currentUser: { id: 1 } },
                res
            );

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it.each([
            [new Error('identity locked'), 'identity locked'],
            [
                Object.assign(new Error(''), { message: '' }),
                'Failed to unlink identity',
            ],
        ])('answers 500 when unlinking fails (%#)', async (error, message) => {
            identities.canUnlink.mockRejectedValue(error);
            const res = response();

            await controller.unlinkIdentity(
                { params: { identityId: '1' }, currentUser: { id: 1 } },
                res
            );

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: message });
        });

        it('names an identity by its slug when the provider is gone', async () => {
            identities.getUserIdentities.mockResolvedValue([
                { id: 1, provider_slug: 'retired' },
            ]);
            providerConfig.getAllProviders.mockResolvedValue([]);
            const res = response();

            await controller.getUserIdentities({ currentUser: { id: 1 } }, res);

            expect(res.json.mock.calls[0][0].identities[0].provider_name).toBe(
                'retired'
            );
        });

        it('answers 500 when identities cannot be read', async () => {
            identities.getUserIdentities.mockRejectedValue(new Error('x'));
            const res = response();

            await controller.getUserIdentities({ currentUser: { id: 1 } }, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
