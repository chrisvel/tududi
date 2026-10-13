jest.mock('../../../../modules/auth/service', () => ({
    getRegistrationStatus: jest.fn(),
    register: jest.fn(),
    verifyEmail: jest.fn(),
    getCurrentUser: jest.fn(),
    login: jest.fn(),
    resendVerification: jest.fn(),
    logout: jest.fn(),
    buildLoginResult: jest.fn(async () => ({ user: {} })),
}));
jest.mock('../../../../config/authConfig', () => ({
    ...jest.requireActual('../../../../config/authConfig'),
    isPasswordAuthEnabled: jest.fn(),
}));
jest.mock('../../../../modules/members/signInLinkService', () => ({
    consume: jest.fn(),
    peek: jest.fn(),
}));
jest.mock('../../../../modules/oidc/auditService', () => ({
    ...jest.requireActual('../../../../modules/oidc/auditService'),
    logLoginFailed: jest.fn(),
    logLoginSuccess: jest.fn(),
    logSignInLinkUsed: jest.fn(),
}));
jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
}));

const controller = require('../../../../modules/auth/controller');
const authService = require('../../../../modules/auth/service');
const { isPasswordAuthEnabled } = require('../../../../config/authConfig');
const signInLinkService = require('../../../../modules/members/signInLinkService');
const auditService = require('../../../../modules/oidc/auditService');

const response = () => {
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(() => res),
        redirect: jest.fn(),
    };
    return res;
};

const failure = (statusCode, message = 'nope') =>
    Object.assign(new Error(message), statusCode ? { statusCode } : {});

// What the sign-in controller answers when its service fails in ways the
// integration tests do not cause: unexpected errors, session stores that
// fail while switching accounts, and a 401 for an email that is not text.
describe('authController edge cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each([
        ['getRegistrationStatus', () => authService.getRegistrationStatus],
        ['verifyEmail', () => authService.verifyEmail],
        ['resendVerification', () => authService.resendVerification],
    ])('%s passes a failure on', async (method, service) => {
        const error = failure(undefined);
        service().mockRejectedValue(error);
        const next = jest.fn();

        await controller[method](
            { body: {}, query: {}, session: {} },
            response(),
            next
        );

        expect(next).toHaveBeenCalledWith(error);
    });

    it('passes a failure to read the password setting on', () => {
        const error = new Error('config broken');
        isPasswordAuthEnabled.mockImplementation(() => {
            throw error;
        });
        const next = jest.fn();

        controller.getPasswordAuthStatus({}, response(), next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('answers 500 for an unexpected registration failure', async () => {
        authService.register.mockRejectedValue(failure(undefined));
        const res = response();

        await controller.register({ body: {} }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('answers 500 when the current user cannot be read', async () => {
        authService.getCurrentUser.mockRejectedValue(failure(undefined));
        const res = response();

        await controller.getCurrentUser({ session: {} }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
    });

    describe('redeemSignInLink', () => {
        beforeEach(() => {
            signInLinkService.consume.mockResolvedValue({
                member: { id: 4 },
                issuedByUserId: 1,
            });
        });

        it('fails when a fresh session cannot be started', async () => {
            const error = new Error('cannot regenerate');
            const next = jest.fn();

            await controller.redeemSignInLink(
                {
                    body: { token: 't' },
                    session: { regenerate: (cb) => cb(error) },
                },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith(error);
        });

        it('fails when the new session cannot be saved', async () => {
            const error = new Error('cannot save');
            const next = jest.fn();

            await controller.redeemSignInLink(
                {
                    body: { token: 't' },
                    session: {
                        regenerate: (cb) => cb(),
                        save: (cb) => cb(error),
                    },
                },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith(error);
            expect(auditService.logSignInLinkUsed).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('records a failed sign-in with no email when the email is not text', async () => {
            authService.login.mockRejectedValue(failure(401));
            const res = response();

            await controller.login(
                { body: { email: ['a@example.com'] }, session: {} },
                res,
                jest.fn()
            );

            expect(auditService.logLoginFailed).toHaveBeenCalledWith(
                null,
                expect.anything(),
                expect.anything(),
                null,
                'invalid_credentials'
            );
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('answers 403 without the unverified flag when it is not set', async () => {
            authService.login.mockRejectedValue(failure(403));
            const res = response();

            await controller.login(
                { body: { email: 'a@example.com' }, session: {} },
                res,
                jest.fn()
            );

            expect(res.json).toHaveBeenCalledWith({
                error: 'nope',
                email_not_verified: false,
            });
        });

        it('answers 500 for an unexpected failure', async () => {
            authService.login.mockRejectedValue(failure(undefined));
            const res = response();

            await controller.login(
                { body: { email: 'a@example.com' }, session: {} },
                res,
                jest.fn()
            );

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    it('answers 500 when signing out fails', async () => {
        authService.logout.mockRejectedValue(new Error('Could not log out'));
        const res = response();

        await controller.logout({ session: {} }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Could not log out' });
    });
});
