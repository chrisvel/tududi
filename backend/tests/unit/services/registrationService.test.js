const { User } = require('../../../models');
const { getConfig } = require('../../../config/config');
const { sendEmail } = require('../../../services/emailService');
const {
    isRegistrationEnabled,
    generateVerificationToken,
    createUnverifiedUser,
    verifyUserEmail,
    sendVerificationEmail,
    isVerificationTokenValid,
    cleanupExpiredTokens,
} = require('../../../services/registrationService');

jest.mock('../../../config/config');
jest.mock('../../../services/emailService');
jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
}));

describe('registrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isRegistrationEnabled', () => {
        it('should return true when registration is enabled', () => {
            getConfig.mockReturnValue({
                registrationConfig: { enabled: true },
            });

            expect(isRegistrationEnabled()).toBe(true);
        });

        it('should return false when registration is disabled', () => {
            getConfig.mockReturnValue({
                registrationConfig: { enabled: false },
            });

            expect(isRegistrationEnabled()).toBe(false);
        });
    });

    describe('generateVerificationToken', () => {
        it('should generate a 64-character hex token', () => {
            const token = generateVerificationToken();

            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should generate unique tokens', () => {
            const token1 = generateVerificationToken();
            const token2 = generateVerificationToken();

            expect(token1).not.toBe(token2);
        });
    });

    describe('createUnverifiedUser', () => {
        it('should create user with verification token', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                email_verified: false,
            };

            User.findOne = jest.fn().mockResolvedValue(null);
            User.create = jest.fn().mockResolvedValue(mockUser);

            getConfig.mockReturnValue({
                registrationConfig: { tokenExpiryHours: 24 },
            });

            const result = await createUnverifiedUser('test@example.com', 'password123');

            expect(result.user).toEqual(mockUser);
            expect(result.verificationToken).toHaveLength(64);
            expect(result.tokenExpiresAt).toBeInstanceOf(Date);
            expect(User.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'test@example.com',
                    password: 'password123',
                    email_verified: false,
                    email_verification_token: expect.any(String),
                    email_verification_token_expires_at: expect.any(Date),
                })
            );
        });

        it('should throw error for invalid email', async () => {
            await expect(createUnverifiedUser('invalid-email', 'password123')).rejects.toThrow(
                'Invalid email format'
            );
        });

        it('should throw error for short password', async () => {
            await expect(createUnverifiedUser('test@example.com', '12345')).rejects.toThrow(
                'Password must be at least 6 characters long'
            );
        });

        it('should throw error for existing email', async () => {
            User.findOne = jest.fn().mockResolvedValue({ email: 'test@example.com' });

            await expect(
                createUnverifiedUser('test@example.com', 'password123')
            ).rejects.toThrow('Email already registered');
        });
    });

    describe('isVerificationTokenValid', () => {
        it('should return true for valid token', () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            expect(isVerificationTokenValid('token', futureDate)).toBe(true);
        });

        it('should return false for expired token', () => {
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 1);

            expect(isVerificationTokenValid('token', pastDate)).toBe(false);
        });

        it('should return false for missing token', () => {
            expect(isVerificationTokenValid(null, new Date())).toBe(false);
        });

        it('should return false for missing expiration', () => {
            expect(isVerificationTokenValid('token', null)).toBe(false);
        });
    });

    describe('verifyUserEmail', () => {
        it('should verify user email successfully', async () => {
            const mockUser = {
                id: 1,
                email_verified: false,
                email_verification_token: 'valid-token',
                email_verification_token_expires_at: new Date(Date.now() + 3600000),
                save: jest.fn().mockResolvedValue(true),
            };

            User.findOne = jest.fn().mockResolvedValue(mockUser);

            const result = await verifyUserEmail('valid-token');

            expect(result.email_verified).toBe(true);
            expect(result.email_verification_token).toBe(null);
            expect(result.email_verification_token_expires_at).toBe(null);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw error for missing token', async () => {
            await expect(verifyUserEmail(null)).rejects.toThrow('Verification token is required');
        });

        it('should throw error for invalid token', async () => {
            User.findOne = jest.fn().mockResolvedValue(null);

            await expect(verifyUserEmail('invalid-token')).rejects.toThrow(
                'Invalid verification token'
            );
        });

        it('should throw error for already verified email', async () => {
            const mockUser = {
                email_verified: true,
            };

            User.findOne = jest.fn().mockResolvedValue(mockUser);

            await expect(verifyUserEmail('token')).rejects.toThrow('Email already verified');
        });

        it('should throw error for expired token', async () => {
            const mockUser = {
                email_verified: false,
                email_verification_token: 'token',
                email_verification_token_expires_at: new Date(Date.now() - 3600000),
            };

            User.findOne = jest.fn().mockResolvedValue(mockUser);

            await expect(verifyUserEmail('token')).rejects.toThrow(
                'Verification token has expired'
            );
        });
    });

    describe('sendVerificationEmail', () => {
        it('should send verification email successfully', async () => {
            const mockUser = {
                email: 'test@example.com',
            };

            getConfig.mockReturnValue({
                frontendUrl: 'http://localhost:3000',
                registrationConfig: { tokenExpiryHours: 24 },
            });

            sendEmail.mockResolvedValue({ success: true });

            await sendVerificationEmail(mockUser, 'verification-token');

            expect(sendEmail).toHaveBeenCalledWith({
                to: 'test@example.com',
                subject: 'Welcome to Tududi - Verify your email',
                text: expect.stringContaining('http://localhost:3000/verify-email?token=verification-token'),
                html: expect.stringContaining('http://localhost:3000/verify-email?token=verification-token'),
            });
        });

        it('should throw error when email fails', async () => {
            const mockUser = {
                email: 'test@example.com',
            };

            getConfig.mockReturnValue({
                frontendUrl: 'http://localhost:3000',
                registrationConfig: { tokenExpiryHours: 24 },
            });

            sendEmail.mockRejectedValue(new Error('SMTP error'));

            await expect(
                sendVerificationEmail(mockUser, 'token')
            ).rejects.toThrow('Failed to send verification email');
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('should cleanup expired tokens', async () => {
            User.update = jest.fn().mockResolvedValue([2]);

            const result = await cleanupExpiredTokens();

            expect(result).toBe(2);
            expect(User.update).toHaveBeenCalledWith(
                {
                    email_verification_token: null,
                    email_verification_token_expires_at: null,
                },
                {
                    where: {
                        email_verified: false,
                        email_verification_token_expires_at: {
                            [require('sequelize').Op.lt]: expect.any(Date),
                        },
                    },
                }
            );
        });

        it('should return 0 when no tokens to cleanup', async () => {
            User.update = jest.fn().mockResolvedValue([0]);

            const result = await cleanupExpiredTokens();

            expect(result).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            User.update = jest.fn().mockRejectedValue(new Error('Database error'));

            const result = await cleanupExpiredTokens();

            expect(result).toBe(0);
        });
    });
});
