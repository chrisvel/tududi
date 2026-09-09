const nodemailer = require('nodemailer');
const { getConfig } = require('../../../config/config');
const emailService = require('../../../services/emailService');

const config = getConfig();

describe('emailService configuration', () => {
    let originalEmailConfig;
    let createTransportSpy;

    beforeEach(() => {
        originalEmailConfig = config.emailConfig;
        createTransportSpy = jest
            .spyOn(nodemailer, 'createTransport')
            .mockImplementation((options) => ({ options }));
    });

    afterEach(() => {
        config.emailConfig = originalEmailConfig;
    });

    const setEmailConfig = ({ enabled = true, user, pass } = {}) => {
        config.emailConfig = {
            enabled,
            smtp: {
                host: 'smtp.internal',
                port: 25,
                secure: false,
                auth: { user, pass },
            },
            from: { address: 'noreply@example.com', name: 'Tududi' },
        };
    };

    describe('hasValidEmailConfig', () => {
        it('is valid with host, port and from address but no auth', () => {
            setEmailConfig();
            expect(emailService.hasValidEmailConfig()).toBe(true);
        });

        it('is valid when username and password are provided', () => {
            setEmailConfig({ user: 'user', pass: 'secret' });
            expect(emailService.hasValidEmailConfig()).toBe(true);
        });

        it('is invalid when the host is missing', () => {
            setEmailConfig();
            config.emailConfig.smtp.host = undefined;
            expect(emailService.hasValidEmailConfig()).toBe(false);
        });

        it('is invalid when the from address is missing', () => {
            setEmailConfig();
            config.emailConfig.from.address = undefined;
            expect(emailService.hasValidEmailConfig()).toBe(false);
        });
    });

    describe('transport creation', () => {
        it('omits the auth key entirely when no credentials are set', () => {
            setEmailConfig();
            emailService.initializeEmailService();

            expect(createTransportSpy).toHaveBeenCalledTimes(1);
            const options = createTransportSpy.mock.calls[0][0];
            expect(options).toEqual({
                host: 'smtp.internal',
                port: 25,
                secure: false,
            });
            expect('auth' in options).toBe(false);
        });

        it('passes auth through when credentials are set', () => {
            setEmailConfig({ user: 'user', pass: 'secret' });
            emailService.initializeEmailService();

            expect(createTransportSpy).toHaveBeenCalledTimes(1);
            const options = createTransportSpy.mock.calls[0][0];
            expect(options.auth).toEqual({ user: 'user', pass: 'secret' });
        });

        it('does not build a transport when only a username is set', () => {
            setEmailConfig({ user: 'user' });
            emailService.initializeEmailService();

            const options = createTransportSpy.mock.calls[0][0];
            expect('auth' in options).toBe(false);
        });

        it('does not build a transport when email is disabled', () => {
            setEmailConfig({ enabled: false });
            emailService.initializeEmailService();

            expect(createTransportSpy).not.toHaveBeenCalled();
        });
    });
});
