jest.mock('../../../../config/authConfig', () => ({
    ...jest.requireActual('../../../../config/authConfig'),
    isPasswordAuthEnabled: jest.fn(() => true),
}));
jest.mock('../../../../modules/auth/registrationService', () => ({
    ...jest.requireActual('../../../../modules/auth/registrationService'),
    isRegistrationEnabled: jest.fn(async () => true),
    checkSignupEmailDomain: jest.fn(async () => null),
    createUnverifiedUser: jest.fn(),
    sendVerificationEmail: jest.fn(),
    verifyUserEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
}));
jest.mock('../../../../modules/auth/passwordResetService', () => ({
    requestPasswordReset: jest.fn(),
    resetPasswordWithToken: jest.fn(),
}));
jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
}));

const authService = require('../../../../modules/auth/service');
const { isPasswordAuthEnabled } = require('../../../../config/authConfig');
const registration = require('../../../../modules/auth/registrationService');
const passwordReset = require('../../../../modules/auth/passwordResetService');
const peopleService = require('../../../../modules/people/service');
const { logError } = require('../../../../services/logService');
const { User } = require('../../../../models');
const {
    ForbiddenError,
    UnauthorizedError,
    ValidationError,
} = require('../../../../shared/errors');

// The sign-in, sign-up and recovery answers the integration tests do not
// reach: password sign-in switched off, missing input, verification links
// that failed in each known way, settings stored as broken text, and session
// stores that fail.
describe('authService edge cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isPasswordAuthEnabled.mockReturnValue(true);
        registration.isRegistrationEnabled.mockResolvedValue(true);
        registration.checkSignupEmailDomain.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('with password sign-in switched off', () => {
        beforeEach(() => {
            isPasswordAuthEnabled.mockReturnValue(false);
        });

        it.each([
            ['resendVerification', ['a@example.com']],
            ['forgotPassword', ['a@example.com']],
            ['resetPassword', ['token', 'password123']],
        ])('refuses %s', async (method, args) => {
            await expect(authService[method](...args)).rejects.toBeInstanceOf(
                ForbiddenError
            );
        });
    });

    describe('missing input', () => {
        it('needs an email and a password to register', async () => {
            await expect(
                authService.register('a@example.com', '')
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it.each([
            ['resendVerification', [undefined]],
            ['resendVerification', [42]],
            ['verifyEmail', ['']],
            ['forgotPassword', [['a@example.com']]],
            ['resetPassword', [null, 'password123']],
        ])('%s refuses %p', async (method, args) => {
            await expect(authService[method](...args)).rejects.toBeInstanceOf(
                ValidationError
            );
        });
    });

    describe('register', () => {
        const transactionUser = { id: 1, email: 'new@example.com' };

        beforeEach(() => {
            registration.createUnverifiedUser.mockResolvedValue({
                user: transactionUser,
                verificationToken: 'token',
            });
            registration.sendVerificationEmail.mockResolvedValue({
                success: true,
            });
        });

        it('still registers when the self-person cannot be created', async () => {
            jest.spyOn(peopleService, 'createSelfPerson').mockRejectedValue(
                new Error('people table locked')
            );

            const result = await authService.register(
                'new@example.com',
                'password123'
            );

            expect(result.message).toMatch(/Registration successful/);
            expect(logError).toHaveBeenCalled();
        });

        it('turns a duplicate email into a validation error', async () => {
            registration.createUnverifiedUser.mockRejectedValue(
                new Error('Email already registered')
            );
            await expect(
                authService.register('taken@example.com', 'password123')
            ).rejects.toEqual(
                expect.objectContaining({
                    message: 'Email already registered',
                    constructor: ValidationError,
                })
            );
        });
    });

    describe('verifyEmail', () => {
        it.each([
            ['Email already verified', 'already_verified'],
            ['Verification token has expired', 'expired'],
            ['Something else', 'invalid'],
        ])('redirects with the reason for "%s"', async (message, param) => {
            registration.verifyUserEmail.mockRejectedValue(new Error(message));

            const { redirect } = await authService.verifyEmail('token');

            expect(redirect).toMatch(
                new RegExp(`verified=false&error=${param}$`)
            );
        });
    });

    describe('getCurrentUser', () => {
        it('answers no user when the session points at a deleted account', async () => {
            jest.spyOn(User, 'findByPk').mockResolvedValue(null);
            expect(await authService.getCurrentUser({ userId: 1 })).toEqual({
                user: null,
            });
        });

        it('reads settings stored as text, and ignores broken or missing ones', async () => {
            const stored = {
                1: {
                    uid: 'u1',
                    features: '{"kanban":true}',
                    ui_settings: '{"density":"compact"}',
                    sidebar_settings: '{"collapsed":true}',
                },
                2: {
                    uid: 'u2',
                    features: '{broken',
                    ui_settings: '{broken',
                    sidebar_settings: '{broken',
                },
                3: {
                    uid: 'u3',
                    features: null,
                    ui_settings: null,
                    sidebar_settings: null,
                },
            };
            const realFindByPk = User.findByPk.bind(User);
            jest.spyOn(User, 'findByPk').mockImplementation(
                async (id, options) =>
                    options?.attributes?.includes('features')
                        ? stored[id]
                        : realFindByPk(id, options)
            );

            const good = await authService.getCurrentUser({ userId: 1 });
            const broken = await authService.getCurrentUser({ userId: 2 });
            const empty = await authService.getCurrentUser({ userId: 3 });

            expect(good.user.features).toEqual({ kanban: true });
            expect(good.user.ui_settings).toEqual({ density: 'compact' });
            expect(good.user.sidebar_settings).toEqual({ collapsed: true });
            expect(broken.user.features).toEqual({});
            expect(broken.user.ui_settings).toBeNull();
            expect(broken.user.sidebar_settings).toBeNull();
            expect(empty.user.features).toEqual({});
            expect(empty.user.ui_settings).toBeNull();
            expect(empty.user.sidebar_settings).toBeNull();
        });
    });

    describe('login', () => {
        it('points an SSO account without a password to its provider', async () => {
            jest.replaceProperty(process, 'env', {
                ...process.env,
                OIDC_ENABLED: 'true',
            });
            jest.spyOn(User, 'findOne').mockResolvedValue({
                password_digest: null,
            });

            await expect(
                authService.login('sso@example.com', 'password123', {})
            ).rejects.toEqual(
                expect.objectContaining({
                    message: expect.stringMatching(/SSO provider/),
                })
            );
        });

        it('points an account without a password to password recovery', async () => {
            jest.replaceProperty(process, 'env', {
                ...process.env,
                OIDC_ENABLED: undefined,
            });
            jest.spyOn(User, 'findOne').mockResolvedValue({
                password_digest: null,
            });

            const attempt = authService.login(
                'nopass@example.com',
                'password123',
                {}
            );
            await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
            await expect(attempt).rejects.toEqual(
                expect.objectContaining({
                    message: expect.stringMatching(/Forgot password/),
                })
            );
        });

        it('fails when the session cannot be saved', async () => {
            jest.spyOn(User, 'findOne').mockResolvedValue({
                id: 1,
                password_digest: 'hash',
                email_verified: true,
            });
            jest.spyOn(User, 'checkPassword').mockResolvedValue(true);
            const session = {
                save: (callback) => callback(new Error('store down')),
            };

            await expect(
                authService.login('a@example.com', 'password123', session)
            ).rejects.toThrow('store down');
        });
    });

    describe('logout', () => {
        it('reports a session store failure', async () => {
            await expect(
                authService.logout({
                    destroy: (callback) => callback(new Error('store down')),
                })
            ).rejects.toThrow('Could not log out');
            expect(logError).toHaveBeenCalled();
        });
    });

    it('resets a password and names the account', async () => {
        passwordReset.resetPasswordWithToken.mockResolvedValue({
            email: 'a@example.com',
        });
        expect(await authService.resetPassword('token', 'password123')).toEqual(
            { message: 'Password updated', email: 'a@example.com' }
        );
    });
});
