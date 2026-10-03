jest.mock('../../../../services/emailService', () => ({
    isEmailEnabled: jest.fn(() => true),
    sendEmail: jest.fn(async () => ({ success: true })),
}));
jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
    logInfo: jest.fn(),
}));

const registration = require('../../../../modules/auth/registrationService');
const {
    isEmailEnabled,
    sendEmail,
} = require('../../../../services/emailService');
const { logError, logInfo } = require('../../../../services/logService');
const { Setting, User } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');

let counter = 0;
const email = () => `reg-edge-${Date.now()}-${++counter}@example.com`;

// Sign-up and email verification on the paths the integration tests leave
// out: the registration switch itself, bad input, every way a verification
// link can be wrong, resending, failed emails and the token cleanup.
describe('registrationService edge cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isEmailEnabled.mockReturnValue(true);
        sendEmail.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('the registration switch', () => {
        it('is off when it was never set', async () => {
            await Setting.destroy({ where: { key: 'registration_enabled' } });
            expect(await registration.isRegistrationEnabled()).toBe(false);
        });

        it('can be turned on and off', async () => {
            await registration.setRegistrationEnabled(true);
            expect(await registration.isRegistrationEnabled()).toBe(true);
            await registration.setRegistrationEnabled(false);
            expect(await registration.isRegistrationEnabled()).toBe(false);
            expect(logInfo).toHaveBeenCalledWith(
                'Registration disabled by admin'
            );
        });
    });

    describe('createUnverifiedUser', () => {
        it('refuses a malformed email', async () => {
            await expect(
                registration.createUnverifiedUser('not-an-email', 'password123')
            ).rejects.toThrow('Invalid email format');
        });

        it('refuses a short password', async () => {
            await expect(
                registration.createUnverifiedUser(email(), 'x')
            ).rejects.toThrow();
        });

        it('refuses an address that already has an account', async () => {
            const existing = await createTestUser({ email: email() });
            await expect(
                registration.createUnverifiedUser(existing.email, 'password123')
            ).rejects.toThrow('Email already registered');
        });

        it('works without a transaction', async () => {
            const { user } = await registration.createUnverifiedUser(
                email(),
                'password123'
            );
            expect(user.email_verified).toBe(false);
        });
    });

    describe('verifyUserEmail', () => {
        it('needs a token', async () => {
            await expect(registration.verifyUserEmail('')).rejects.toThrow(
                'Verification token is required'
            );
        });

        it('refuses a token nobody holds', async () => {
            await expect(
                registration.verifyUserEmail('unknown-token')
            ).rejects.toThrow('Invalid verification token');
        });

        it('refuses an address that is already verified', async () => {
            await createTestUser({
                email: email(),
                email_verified: true,
                email_verification_token: `done-${counter}`,
            });
            await expect(
                registration.verifyUserEmail(`done-${counter}`)
            ).rejects.toThrow('Email already verified');
        });

        it('refuses a token without an expiry', async () => {
            await createTestUser({
                email: email(),
                email_verified: false,
                email_verification_token: `noexpiry-${counter}`,
                email_verification_token_expires_at: null,
            });
            await expect(
                registration.verifyUserEmail(`noexpiry-${counter}`)
            ).rejects.toThrow('Verification token has expired');
        });

        it('refuses an expired token', async () => {
            await createTestUser({
                email: email(),
                email_verified: false,
                email_verification_token: `old-${counter}`,
                email_verification_token_expires_at: new Date(
                    Date.now() - 60000
                ),
            });
            await expect(
                registration.verifyUserEmail(`old-${counter}`)
            ).rejects.toThrow('Verification token has expired');
        });
    });

    describe('resendVerificationEmail', () => {
        it('sends nothing for an unknown address', async () => {
            expect(await registration.resendVerificationEmail(email())).toEqual(
                { sent: false }
            );
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it('sends a fresh link to an unverified account', async () => {
            const user = await createTestUser({
                email: email(),
                email_verified: false,
                email_verification_token: 'first',
            });

            expect(
                await registration.resendVerificationEmail(user.email)
            ).toEqual({ sent: true });
            const after = await User.findByPk(user.id);
            expect(after.email_verification_token).not.toBe('first');
        });

        it('reports a link it could not send', async () => {
            const user = await createTestUser({
                email: email(),
                email_verified: false,
            });
            sendEmail.mockResolvedValue({ success: false, reason: 'smtp' });

            expect(
                await registration.resendVerificationEmail(user.email)
            ).toEqual({ sent: false });
            expect(logError).toHaveBeenCalled();
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('clears expired tokens and reports how many', async () => {
            await createTestUser({
                email: email(),
                email_verified: false,
                email_verification_token: 'stale',
                email_verification_token_expires_at: new Date(
                    Date.now() - 60000
                ),
            });

            expect(await registration.cleanupExpiredTokens()).toBeGreaterThan(
                0
            );
            expect(await registration.cleanupExpiredTokens()).toBe(0);
        });

        it('reports nothing cleaned when the update fails', async () => {
            jest.spyOn(User, 'update').mockRejectedValue(new Error('locked'));
            expect(await registration.cleanupExpiredTokens()).toBe(0);
            expect(logError).toHaveBeenCalled();
        });
    });
});
