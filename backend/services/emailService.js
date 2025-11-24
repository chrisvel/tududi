const nodemailer = require('nodemailer');
const { getConfig } = require('../config/config');
const { logError, logInfo } = require('./logService');

let transporter = null;

const isEmailEnabled = () => {
    const config = getConfig();
    return config.emailConfig.enabled;
};

const hasValidEmailConfig = () => {
    const config = getConfig();
    const { smtp, from } = config.emailConfig;
    return !!(smtp.host && smtp.auth.user && smtp.auth.pass && from.address);
};

const createTransporter = () => {
    if (!isEmailEnabled()) {
        return null;
    }

    if (!hasValidEmailConfig()) {
        logError(
            new Error(
                'Email is enabled but configuration is incomplete. Email service will not function.'
            )
        );
        return null;
    }

    const config = getConfig();
    const { smtp } = config.emailConfig;

    try {
        return nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
                user: smtp.auth.user,
                pass: smtp.auth.pass,
            },
        });
    } catch (error) {
        logError(error, 'Failed to create email transporter');
        return null;
    }
};

const initializeEmailService = () => {
    if (!isEmailEnabled()) {
        logInfo('Email service is disabled');
        return;
    }

    transporter = createTransporter();

    if (transporter) {
        logInfo('Email service initialized successfully');
    }
};

const sendEmail = async ({ to, subject, text, html }) => {
    if (!isEmailEnabled()) {
        logInfo(
            `Email would be sent to ${to} with subject: "${subject}" (email service is disabled)`
        );
        return { success: false, reason: 'Email service is disabled' };
    }

    if (!transporter) {
        return { success: false, reason: 'Email transporter not initialized' };
    }

    if (!to || !subject) {
        return {
            success: false,
            reason: 'Missing required fields: to, subject',
        };
    }

    if (!text && !html) {
        return {
            success: false,
            reason: 'Either text or html content is required',
        };
    }

    const config = getConfig();
    const { from } = config.emailConfig;

    const mailOptions = {
        from: from.name ? `"${from.name}" <${from.address}>` : from.address,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        logError(error, `Failed to send email to ${to}`);
        return {
            success: false,
            reason: error.message,
        };
    }
};

const verifyEmailConnection = async () => {
    if (!isEmailEnabled()) {
        return { success: false, reason: 'Email service is disabled' };
    }

    if (!transporter) {
        return { success: false, reason: 'Email transporter not initialized' };
    }

    try {
        await transporter.verify();
        return { success: true };
    } catch (error) {
        logError(error, 'Email connection verification failed');
        return {
            success: false,
            reason: error.message,
        };
    }
};

module.exports = {
    initializeEmailService,
    sendEmail,
    verifyEmailConnection,
    isEmailEnabled,
    hasValidEmailConfig,
};
