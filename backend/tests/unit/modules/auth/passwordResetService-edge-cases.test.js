jest.mock('../../../../services/emailService', () => ({
    isEmailEnabled: jest.fn(),
    sendEmail: jest.fn(),
}));
jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
    logInfo: jest.fn(),
}));

const {
    sendMemberInviteEmail,
    requestPasswordReset,
} = require('../../../../modules/auth/passwordResetService');
const {
    isEmailEnabled,
    sendEmail,
} = require('../../../../services/emailService');
const { logError, logInfo } = require('../../../../services/logService');
const { User } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');

let counter = 0;
const newUser = () =>
    createTestUser({
        email: `reset-edge-${Date.now()}-${++counter}@example.com`,
    });

// Invitations and reset links when email is off or the mail server refuses:
// the token is still recorded, nothing is sent, and the failure is logged.
describe('passwordResetService edge cases', () => {
    beforeEach(() => {
        isEmailEnabled.mockReturnValue(true);
        sendEmail.mockResolvedValue({ success: true });
    });

    describe('sendMemberInviteEmail', () => {
        it('records the link but sends nothing when email is off', async () => {
            isEmailEnabled.mockReturnValue(false);
            const user = await newUser();

            expect(await sendMemberInviteEmail(user)).toEqual({ sent: false });
            expect(sendEmail).not.toHaveBeenCalled();
            expect(
                (await User.findByPk(user.id)).password_reset_token_hash
            ).toBeTruthy();
        });

        it('reports an invitation the mail server refused', async () => {
            sendEmail.mockResolvedValue({ success: false, reason: 'smtp' });
            const user = await newUser();

            expect(await sendMemberInviteEmail(user)).toEqual({ sent: false });
            expect(logError).toHaveBeenCalled();
        });
    });

    describe('requestPasswordReset', () => {
        it('records the link but sends nothing when email is off', async () => {
            isEmailEnabled.mockReturnValue(false);
            const user = await newUser();

            await requestPasswordReset(user.email);

            expect(sendEmail).not.toHaveBeenCalled();
            expect(logInfo).toHaveBeenCalledWith(
                expect.stringMatching(/Email service is disabled/)
            );
        });

        it('logs a reset link the mail server refused', async () => {
            sendEmail.mockResolvedValue({ success: false, reason: 'smtp' });
            const user = await newUser();

            await requestPasswordReset(user.email);

            expect(logError).toHaveBeenCalled();
        });
    });
});
