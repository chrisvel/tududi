'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../../models');
const { getConfig } = require('../../config/config');
const { logError, logInfo } = require('../../services/logService');
const { isEmailEnabled } = require('../../services/emailService');
const { deliver } = require('../../services/emailDeliveryService');
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

// Store a fresh set-password token (SHA-256 hashed) on the account and return
// the raw token for the emailed link. Shared by the password-reset flow and the
// admin member-invite flow.
async function issueResetToken(user, expiresAt = tokenExpiry()) {
    const token = crypto.randomBytes(32).toString('hex');
    await user.update({
        password_reset_token_hash: hashToken(token),
        password_reset_token_expires_at: expiresAt,
    });
    return token;
}

// Creates a set-password token for an admin-created account and emails the
// activation link. Returns whether the email was actually sent so the caller
// can report it; unlike registration, the account is kept either way.
async function sendMemberInviteEmail(user, { triggeredBy = null } = {}) {
    const config = getConfig();
    const hours = config.inviteTokenExpiryHours;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const token = await issueResetToken(user, expiresAt);

    if (!isEmailEnabled()) {
        logInfo(
            `Email service is disabled. Invite link for ${user.email} not sent.`
        );
        return { sent: false };
    }

    const setPasswordUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const result = await deliver('memberInvite', {
        user,
        triggeredBy,
        vars: { url: setPasswordUrl, expiryHours: hours },
    });

    if (result.success) {
        logInfo(`Member invite email sent to ${user.email}`);
    } else {
        logError(
            new Error(result.reason),
            `Failed to send member invite email to ${user.email}`
        );
    }
    return { sent: !!result.success };
}

// Records a reset token for the account behind `email` (if any) and emails
// the link. Returns nothing the caller could use to tell the cases apart.
async function requestPasswordReset(email, { triggeredBy = null } = {}) {
    const normalized = String(email).trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalized } });
    if (!user) {
        logInfo(`Password reset requested for unknown email ${normalized}`);
        return;
    }

    const token = await issueResetToken(user);

    if (!isEmailEnabled()) {
        logInfo(
            `Email service is disabled. Password reset link for ${user.email} not sent.`
        );
        return;
    }

    const config = getConfig();
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const minutes = config.passwordResetConfig.tokenExpiryMinutes;
    const result = await deliver('passwordReset', {
        user,
        triggeredBy,
        vars: { url: resetUrl, expiryMinutes: minutes },
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

    const wasVerified = user.email_verified;

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

    // Using the reset link proves the address, the same as verifying it.
    if (!wasVerified) {
        await require('../../services/entitlementsService').startTrial(user.id);
    }

    return user;
}

module.exports = {
    requestPasswordReset,
    resetPasswordWithToken,
    sendMemberInviteEmail,
    issueResetToken,
    hashToken,
};
