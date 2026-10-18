const crypto = require('crypto');
const { User, Setting } = require('../../models');
const { getConfig } = require('../../config/config');
const { logError, logInfo } = require('../../services/logService');
const { normalizeLanguage } = require('../../emails');
const { deliver } = require('../../services/emailDeliveryService');
const {
    canonicalEmail,
    domainOf,
    isDisposableDomain,
    acceptsMail,
} = require('../../services/emailDomainService');
const {
    validateEmail,
    validatePassword,
    MIN_LENGTH_POLICY_MESSAGE,
} = require('../users/userService');
const {
    getDefaultNotificationPreferences,
} = require('../../utils/notificationPreferences');

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

const DISPOSABLE_EMAIL_MESSAGE =
    'Please sign up with a permanent email address. Temporary or disposable addresses are not accepted.';
const UNDELIVERABLE_EMAIL_MESSAGE =
    'This email address cannot receive mail. Please check it and try again.';

// Returns why the address cannot be used for a new account, or null. A
// malformed address passes here and is reported by createUnverifiedUser.
// Reserved names like .local get no rule of their own: the MX check covers
// them, and a self-hosted instance whose internal DNS serves its own mail
// domain keeps working.
const checkSignupEmailDomain = async (email) => {
    if (!validateEmail(email)) return null;

    const domain = domainOf(email);
    if (isDisposableDomain(domain)) return DISPOSABLE_EMAIL_MESSAGE;
    if (
        getConfig().registrationConfig.mxCheck &&
        !(await acceptsMail(domain))
    ) {
        return UNDELIVERABLE_EMAIL_MESSAGE;
    }
    return null;
};

// On a hosted instance one mailbox gets one account, so a "+tag" or Gmail
// dots cannot open a second trial. A self-hosted instance may well want
// alias accounts (for testing, or one per role), so it is not checked there.
const isTakenMailbox = async (email, transaction = null) => {
    if (getConfig().hosted?.enabled !== true) return false;
    const canonical = canonicalEmail(email);
    if (!canonical) return false;
    const existing = await User.findOne({
        where: { email_canonical: canonical },
        attributes: ['id'],
        transaction,
    });
    return !!existing;
};

// `language` is the one the sign-up form was shown in, so the first emails
// already arrive in it.
const createUnverifiedUser = async (
    email,
    password,
    transaction = null,
    { language } = {}
) => {
    if (!validateEmail(email)) {
        throw new Error('Invalid email format');
    }

    if (!validatePassword(password)) {
        throw new Error(MIN_LENGTH_POLICY_MESSAGE);
    }

    const existingUser = await User.findOne({
        where: { email: email.trim().toLowerCase() },
        transaction,
    });
    if (existingUser || (await isTakenMailbox(email, transaction))) {
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
            notification_preferences: getDefaultNotificationPreferences(),
            language: normalizeLanguage(language),
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

// Issues a fresh verification token for an unverified account and emails
// it. Verified or unknown addresses are ignored so the caller's response can
// stay identical in every case.
const resendVerificationEmail = async (email) => {
    const user = await User.findOne({
        where: { email: String(email).trim().toLowerCase() },
    });
    if (!user || user.email_verified) {
        return { sent: false };
    }

    const verificationToken = generateVerificationToken();
    await user.update({
        email_verification_token: verificationToken,
        email_verification_token_expires_at: getTokenExpirationDate(),
    });

    const result = await sendVerificationEmail(user, verificationToken);
    return { sent: !!result.success };
};

// Sends the verification email again with a fresh link, from the admin's
// email panel. `reminder` sends the reminder wording and counts as the one
// reminder the daily job would send.
const sendFreshVerification = async (
    user,
    { reminder = false, triggeredBy = null } = {}
) => {
    const verificationToken = generateVerificationToken();
    await user.update({
        email_verification_token: verificationToken,
        email_verification_token_expires_at: getTokenExpirationDate(),
        ...(reminder ? { verification_reminder_sent_at: new Date() } : {}),
    });
    return sendVerificationEmail(user, verificationToken, {
        reminder,
        triggeredBy,
    });
};

// One reminder, with a fresh link (the first one has expired by now), for a
// self-registered hosted account that signed up between one and seven days
// ago and has not verified. Members invited by an owner have their own
// invitation and are left out.
const sendVerificationReminders = async ({ now = new Date() } = {}) => {
    const config = getConfig();
    if (config.hosted?.enabled !== true) return [];
    const { isEmailEnabled } = require('../../services/emailService');
    if (!isEmailEnabled()) return [];

    const { Op } = require('sequelize');
    const DAY = 24 * 60 * 60 * 1000;
    const users = await User.findAll({
        where: {
            email_verified: false,
            email: { [Op.ne]: null },
            created_by_user_id: null,
            verification_reminder_sent_at: null,
            created_at: {
                [Op.lte]: new Date(now.getTime() - DAY),
                [Op.gte]: new Date(now.getTime() - 7 * DAY),
            },
        },
    });

    const reminded = [];
    for (const user of users) {
        try {
            const verificationToken = generateVerificationToken();
            await user.update({
                email_verification_token: verificationToken,
                email_verification_token_expires_at: getTokenExpirationDate(),
                verification_reminder_sent_at: now,
            });
            const result = await sendVerificationEmail(
                user,
                verificationToken,
                { reminder: true }
            );
            if (result.success) reminded.push(user.id);
        } catch (error) {
            logError(error, `Failed to remind user ${user.id} to verify`);
        }
    }
    return reminded;
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

    // A Cloud trial starts only once the address is proven to be real.
    await require('../../services/entitlementsService').startTrial(user.id);

    return user;
};

// `reminder` is the follow-up for a sign-up that never verified: same link,
// different opening.
const sendVerificationEmail = async (
    user,
    verificationToken,
    { reminder = false, triggeredBy = null } = {}
) => {
    const config = getConfig();
    const { isEmailEnabled } = require('../../services/emailService');

    if (!isEmailEnabled()) {
        logInfo(
            `Email service is disabled. Verification email for ${user.email} not sent. User must be verified manually.`
        );
        return { success: false, reason: 'Email service is disabled' };
    }

    const verificationUrl = `${config.backendUrl}/api/verify-email?token=${verificationToken}`;
    const tokenExpiryHours = config.registrationConfig.tokenExpiryHours;

    // On Cloud the email also says what the trial gives, since the trial
    // starts on this link.
    const trialDays = config.hosted?.enabled ? config.hosted.trialDays || 0 : 0;
    const result = await deliver('verification', {
        user,
        variant: reminder ? 'reminder' : null,
        triggeredBy,
        vars: {
            url: verificationUrl,
            expiryHours: tokenExpiryHours,
            trialDays,
            reminder,
        },
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
    isTakenMailbox,
    checkSignupEmailDomain,
    verifyUserEmail,
    sendVerificationEmail,
    resendVerificationEmail,
    sendFreshVerification,
    sendVerificationReminders,
    isVerificationTokenValid,
    cleanupExpiredTokens,
};
