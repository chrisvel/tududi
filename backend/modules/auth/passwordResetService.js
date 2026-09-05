'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../../models');
const { getConfig } = require('../../config/config');
const { logError, logInfo } = require('../../services/logService');
const { sendEmail, isEmailEnabled } = require('../../services/emailService');
const { destroyUserSessions } = require('../../services/sessionService');
const {
    validatePassword,
    MIN_LENGTH_POLICY_MESSAGE,
} = require('../users/userService');
const { ValidationError } = require('../../shared/errors');

// Only the hash is stored, so a database read does not yield usable links.
const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

const tokenExpiry = () => {
    const minutes = getConfig().passwordResetConfig.tokenExpiryMinutes;
    return new Date(Date.now() + minutes * 60 * 1000);
};

const buildResetEmail = (resetUrl, minutes) => {
    const subject = 'Reset your Tududi password';
    const text = `Someone asked to reset the password for your Tududi account.

Open this link to choose a new password:

${resetUrl}

The link expires in ${minutes} minutes. If you did not ask for a reset, ignore this email; your password stays as it is.

Best regards,
The Tududi Team`;

    const html = `
<p>Someone asked to reset the password for your Tududi account.</p>

<p style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Choose a new password</a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #666;">${resetUrl}</p>

<p><strong>The link expires in ${minutes} minutes.</strong> If you did not ask for a reset, ignore this email; your password stays as it is.</p>

<p>Best regards,<br>The Tududi Team</p>
`;
    return { subject, text, html };
};

// Records a reset token for the account behind `email` (if any) and emails
// the link. Returns nothing the caller could use to tell the cases apart.
async function requestPasswordReset(email) {
    const normalized = String(email).trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalized } });
    if (!user) {
        logInfo(`Password reset requested for unknown email ${normalized}`);
        return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({
        password_reset_token_hash: hashToken(token),
        password_reset_token_expires_at: tokenExpiry(),
    });

    if (!isEmailEnabled()) {
        logInfo(
            `Email service is disabled. Password reset link for ${user.email} not sent.`
        );
        return;
    }

    const config = getConfig();
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const minutes = config.passwordResetConfig.tokenExpiryMinutes;
    const result = await sendEmail({
        to: user.email,
        ...buildResetEmail(resetUrl, minutes),
    });

    if (result.success) {
        logInfo(`Password reset email sent to ${user.email}`);
    } else {
        logError(
            new Error(result.reason),
            `Failed to send password reset email to ${user.email}`
        );
    }
}

async function resetPasswordWithToken(token, password) {
    if (!validatePassword(password)) {
        throw new ValidationError(MIN_LENGTH_POLICY_MESSAGE);
    }

    const user = await User.findOne({
        where: {
            password_reset_token_hash: hashToken(String(token)),
            password_reset_token_expires_at: { [Op.gt]: new Date() },
        },
    });
    if (!user) {
        throw new ValidationError('Reset link is invalid or has expired');
    }

    // instance.update() only persists the columns it was handed, so the
    // digest is computed here instead of relying on the beforeValidate hook.
    await user.update({
        password_digest: await User.hashPassword(password),
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
        email_verified: true,
    });

    // Whoever held the old password (or a stolen cookie) is signed out.
    await destroyUserSessions(user.id);

    return user;
}

module.exports = {
    requestPasswordReset,
    resetPasswordWithToken,
    hashToken,
};
