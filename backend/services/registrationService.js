const crypto = require('crypto');
const { User, Setting } = require('../models');
const { getConfig } = require('../config/config');
const { logError, logInfo } = require('./logService');
const { sendEmail } = require('./emailService');
const { validateEmail, validatePassword } = require('./userService');

const isRegistrationEnabled = async () => {
    const setting = await Setting.findOne({
        where: { key: 'registration_enabled' },
    });
    // Default to false if setting doesn't exist
    return setting ? setting.value === 'true' : false;
};

const setRegistrationEnabled = async (enabled) => {
    await Setting.upsert({
        key: 'registration_enabled',
        value: String(enabled),
    });
    logInfo(`Registration ${enabled ? 'enabled' : 'disabled'} by admin`);
};

const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const getTokenExpirationDate = () => {
    const config = getConfig();
    const hours = config.registrationConfig.tokenExpiryHours;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + hours);
    return expirationDate;
};

const createUnverifiedUser = async (email, password, transaction = null) => {
    if (!validateEmail(email)) {
        throw new Error('Invalid email format');
    }

    if (!validatePassword(password)) {
        throw new Error('Password must be at least 6 characters long');
    }

    const existingUser = await User.findOne({
        where: { email },
        transaction,
    });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    const verificationToken = generateVerificationToken();
    const tokenExpiresAt = getTokenExpirationDate();

    const user = await User.create(
        {
            email,
            password,
            email_verified: false,
            email_verification_token: verificationToken,
            email_verification_token_expires_at: tokenExpiresAt,
        },
        { transaction }
    );

    return {
        user,
        verificationToken,
        tokenExpiresAt,
    };
};

const isVerificationTokenValid = (token, expiresAt) => {
    if (!token || !expiresAt) {
        return false;
    }

    const now = new Date();
    const expiration = new Date(expiresAt);
    return now <= expiration;
};

const verifyUserEmail = async (token) => {
    if (!token) {
        throw new Error('Verification token is required');
    }

    const user = await User.findOne({
        where: { email_verification_token: token },
    });

    if (!user) {
        throw new Error('Invalid verification token');
    }

    if (user.email_verified) {
        throw new Error('Email already verified');
    }

    if (
        !isVerificationTokenValid(
            token,
            user.email_verification_token_expires_at
        )
    ) {
        throw new Error('Verification token has expired');
    }

    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_token_expires_at = null;
    await user.save();

    return user;
};

const sendVerificationEmail = async (user, verificationToken) => {
    const config = getConfig();
    const { isEmailEnabled } = require('./emailService');

    if (!isEmailEnabled()) {
        logInfo(
            `Email service is disabled. Verification email for ${user.email} not sent. User must be verified manually.`
        );
        return { success: false, reason: 'Email service is disabled' };
    }

    const verificationUrl = `${config.backendUrl}/api/verify-email?token=${verificationToken}`;
    const tokenExpiryHours = config.registrationConfig.tokenExpiryHours;

    const subject = 'Welcome to Tududi - Verify your email';

    const text = `Welcome to Tududi!

Thank you for registering. To complete your registration and start using Tududi, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in ${tokenExpiryHours} hours.

After verification, you'll be able to:
- Create and organize tasks with ease
- Manage projects and areas
- Set up recurring tasks
- Track your productivity

If you didn't create an account with Tududi, you can safely ignore this email.

Best regards,
The Tududi Team`;

    const html = `
<p>Welcome to Tududi!</p>

<p>Thank you for registering. To complete your registration and start using Tududi, please verify your email address by clicking the button below:</p>

<p style="text-align: center; margin: 30px 0;">
    <a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #666;">${verificationUrl}</p>

<p><strong>This verification link will expire in ${tokenExpiryHours} hours.</strong></p>

<p>After verification, you'll be able to:</p>
<ul>
    <li>Create and organize tasks with ease</li>
    <li>Manage projects and areas</li>
    <li>Set up recurring tasks</li>
    <li>Track your productivity</li>
</ul>

<p>If you didn't create an account with Tududi, you can safely ignore this email.</p>

<p>Best regards,<br>The Tududi Team</p>
`;

    const result = await sendEmail({
        to: user.email,
        subject,
        text,
        html,
    });

    if (result.success) {
        logInfo(`Verification email sent to ${user.email}`);
        return result;
    } else {
        logError(
            new Error(result.reason),
            `Failed to send verification email to ${user.email}`
        );
        return result;
    }
};

const cleanupExpiredTokens = async () => {
    const now = new Date();

    try {
        const result = await User.update(
            {
                email_verification_token: null,
                email_verification_token_expires_at: null,
            },
            {
                where: {
                    email_verified: false,
                    email_verification_token_expires_at: {
                        [require('sequelize').Op.lt]: now,
                    },
                },
            }
        );

        if (result[0] > 0) {
            logInfo(`Cleaned up ${result[0]} expired verification tokens`);
        }

        return result[0];
    } catch (error) {
        logError(error, 'Failed to cleanup expired tokens');
        return 0;
    }
};

module.exports = {
    isRegistrationEnabled,
    setRegistrationEnabled,
    generateVerificationToken,
    createUnverifiedUser,
    verifyUserEmail,
    sendVerificationEmail,
    isVerificationTokenValid,
    cleanupExpiredTokens,
};
