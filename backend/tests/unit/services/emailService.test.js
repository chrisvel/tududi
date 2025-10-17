jest.mock('nodemailer');
jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

describe('emailService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        delete process.env.ENABLE_EMAIL;
        delete process.env.EMAIL_SMTP_HOST;
        delete process.env.EMAIL_SMTP_PORT;
        delete process.env.EMAIL_SMTP_SECURE;
        delete process.env.EMAIL_SMTP_USERNAME;
        delete process.env.EMAIL_SMTP_PASSWORD;
        delete process.env.EMAIL_FROM_ADDRESS;
        delete process.env.EMAIL_FROM_NAME;
    });

    describe('isEmailEnabled', () => {
        it('should return false when email is disabled', () => {
            const { getConfig } = require('../../../config/config');
            const { isEmailEnabled } = require('../../../services/emailService');
            const config = getConfig();
            expect(config.emailConfig.enabled).toBe(false);
            expect(isEmailEnabled()).toBe(false);
        });

        it('should return true when email is enabled', () => {
            process.env.ENABLE_EMAIL = 'true';
            const { getConfig } = require('../../../config/config');
            const { isEmailEnabled } = require('../../../services/emailService');
            const config = getConfig();
            expect(config.emailConfig.enabled).toBe(true);
            expect(isEmailEnabled()).toBe(true);
        });
    });

    describe('hasValidEmailConfig', () => {
        it('should return false when required config is missing', () => {
            const { hasValidEmailConfig } = require('../../../services/emailService');
            expect(hasValidEmailConfig()).toBe(false);
        });

        it('should return true when all required config is present', () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';
            const { hasValidEmailConfig } = require('../../../services/emailService');
            expect(hasValidEmailConfig()).toBe(true);
        });
    });

    describe('sendEmail', () => {
        it('should return failure when email is disabled', async () => {
            const { sendEmail } = require('../../../services/emailService');
            const result = await sendEmail({
                to: 'user@example.com',
                subject: 'Test',
                text: 'Test message',
            });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Email service is disabled');
        });

        it('should return failure when required fields are missing', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockTransporter = {
                sendMail: jest.fn(),
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { sendEmail, initializeEmailService } = require('../../../services/emailService');
            initializeEmailService();

            const resultNoTo = await sendEmail({
                subject: 'Test',
                text: 'Test message',
            });
            expect(resultNoTo.success).toBe(false);
            expect(resultNoTo.reason).toContain('Missing required fields');

            const resultNoSubject = await sendEmail({
                to: 'user@example.com',
                text: 'Test message',
            });
            expect(resultNoSubject.success).toBe(false);
            expect(resultNoSubject.reason).toContain('Missing required fields');
        });

        it('should return failure when neither text nor html is provided', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockTransporter = {
                sendMail: jest.fn(),
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { sendEmail, initializeEmailService } = require('../../../services/emailService');
            initializeEmailService();

            const result = await sendEmail({
                to: 'user@example.com',
                subject: 'Test',
            });
            expect(result.success).toBe(false);
            expect(result.reason).toContain('text or html content is required');
        });

        it('should send email successfully with text content', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';
            process.env.EMAIL_FROM_NAME = 'Test App';

            const mockSendMail = jest.fn().mockResolvedValue({
                messageId: 'test-message-id',
            });
            const mockTransporter = {
                sendMail: mockSendMail,
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService, sendEmail } = require('../../../services/emailService');
            initializeEmailService();

            const result = await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test message content',
            });

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id');
            expect(mockSendMail).toHaveBeenCalledWith({
                from: '"Test App" <noreply@example.com>',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test message content',
                html: undefined,
            });
        });

        it('should send email successfully with html content', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockSendMail = jest.fn().mockResolvedValue({
                messageId: 'test-message-id-2',
            });
            const mockTransporter = {
                sendMail: mockSendMail,
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService, sendEmail } = require('../../../services/emailService');
            initializeEmailService();

            const result = await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                html: '<p>Test HTML content</p>',
            });

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id-2');
            expect(mockSendMail).toHaveBeenCalledWith({
                from: '"Tududi" <noreply@example.com>',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: undefined,
                html: '<p>Test HTML content</p>',
            });
        });

        it('should handle send email errors gracefully', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));
            const mockTransporter = {
                sendMail: mockSendMail,
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService, sendEmail } = require('../../../services/emailService');
            initializeEmailService();

            const result = await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test message',
            });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('SMTP error');
        });
    });

    describe('initializeEmailService', () => {
        it('should not initialize when email is disabled', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            const { initializeEmailService } = require('../../../services/emailService');

            initializeEmailService();

            expect(consoleLogSpy).toHaveBeenCalledWith('Email service is disabled');
            consoleLogSpy.mockRestore();
        });

        it('should initialize successfully with valid config', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockTransporter = {
                sendMail: jest.fn(),
                verify: jest.fn().mockResolvedValue(true),
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService } = require('../../../services/emailService');
            initializeEmailService();

            expect(nodemailer.createTransport).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('Email service initialized successfully');
            consoleLogSpy.mockRestore();
        });

        it('should warn when config is incomplete', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';

            const { initializeEmailService } = require('../../../services/emailService');
            initializeEmailService();

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Email is enabled but configuration is incomplete. Email service will not function.'
            );
            consoleWarnSpy.mockRestore();
        });
    });

    describe('verifyEmailConnection', () => {
        it('should return failure when email is disabled', async () => {
            const { verifyEmailConnection } = require('../../../services/emailService');
            const result = await verifyEmailConnection();

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Email service is disabled');
        });

        it('should verify connection successfully', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockVerify = jest.fn().mockResolvedValue(true);
            const mockTransporter = {
                sendMail: jest.fn(),
                verify: mockVerify,
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService, verifyEmailConnection } = require('../../../services/emailService');
            initializeEmailService();

            const result = await verifyEmailConnection();

            expect(result.success).toBe(true);
            expect(mockVerify).toHaveBeenCalled();
        });

        it('should handle verification errors', async () => {
            process.env.ENABLE_EMAIL = 'true';
            process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
            process.env.EMAIL_SMTP_USERNAME = 'user@example.com';
            process.env.EMAIL_SMTP_PASSWORD = 'password123';
            process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';

            const mockVerify = jest.fn().mockRejectedValue(new Error('Connection failed'));
            const mockTransporter = {
                sendMail: jest.fn(),
                verify: mockVerify,
            };
            const nodemailer = require('nodemailer');
            nodemailer.createTransport.mockReturnValue(mockTransporter);

            const { initializeEmailService, verifyEmailConnection } = require('../../../services/emailService');
            initializeEmailService();

            const result = await verifyEmailConnection();

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Connection failed');
        });
    });
});
