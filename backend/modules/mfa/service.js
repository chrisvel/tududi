'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const {
    User,
    UserMfa,
    UserRecoveryCode,
    AuthAuditLog,
    sequelize,
} = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const totp = require('./totp');
const auditService = require('../oidc/auditService');
const { destroyUserSessions } = require('../../services/sessionService');
const { deliver } = require('../../services/emailDeliveryService');
const { isEmailEnabled } = require('../../services/emailService');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');
const {
    ValidationError,
    ForbiddenError,
    AppError,
} = require('../../shared/errors');

const ISSUER = 'Tududi';
const SETUP_TTL_MS = 10 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;
// No 0/o, 1/l/i: a code is read off paper and typed back.
const RECOVERY_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
// Failed codes per user across every session and sign-in attempt.
const FAILURE_LIMIT = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

// 400, not 401: a signed-in client reads 401 as "signed out".
class InvalidCodeError extends AppError {
    constructor(message = 'That code is not right. Try again.') {
        super(message, 400, 'INVALID_CODE');
    }
}

class TooManyAttemptsError extends AppError {
    constructor() {
        super(
            'Too many incorrect codes. Please try again in 15 minutes.',
            429,
            'TOO_MANY_ATTEMPTS'
        );
    }
}

function requestMeta(req) {
    return {
        ipAddress: req?.ip || null,
        userAgent: req?.get ? req.get('user-agent') : null,
    };
}

function logMfaEvent(userId, eventType, req, metadata = null) {
    return auditService.logEvent({
        userId,
        eventType,
        authMethod: auditService.AUTH_METHODS.MFA,
        metadata,
        ...requestMeta(req),
    });
}

// Security emails never hold up the change they report.
function notify(user, event) {
    if (!user?.email || !isEmailEnabled()) return;
    const url = `${getConfig().frontendUrl}/profile?section=security`;
    deliver('securityNotice', {
        user,
        variant: event,
        vars: { event, url },
    }).catch((error) => logError(error, `Could not send the ${event} email`));
}

function generateRecoveryCode() {
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
    }
    return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function normalizeRecoveryCode(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

async function replaceRecoveryCodes(userId, transaction) {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
        generateRecoveryCode()
    );
    const hashes = await Promise.all(
        codes.map((code) => bcrypt.hash(normalizeRecoveryCode(code), 10))
    );
    await UserRecoveryCode.destroy({ where: { user_id: userId }, transaction });
    await UserRecoveryCode.bulkCreate(
        hashes.map((code_hash) => ({ user_id: userId, code_hash })),
        { transaction }
    );
    return codes;
}

async function findMfa(userId) {
    return UserMfa.findOne({ where: { user_id: userId } });
}

async function isEnabled(userId) {
    return (await UserMfa.count({ where: { user_id: userId } })) > 0;
}

async function recoveryCodesLeft(userId) {
    return UserRecoveryCode.count({
        where: { user_id: userId, used_at: null },
    });
}

async function getStatus(userId) {
    const mfa = await findMfa(userId);
    return {
        enabled: !!mfa,
        enabled_at: mfa ? mfa.enabled_at : null,
        recovery_codes_left: mfa ? await recoveryCodesLeft(userId) : 0,
        available: secretCipher.hasKeyMaterial(),
    };
}

async function assertNotLockedOut(userId) {
    const failures = await AuthAuditLog.count({
        where: {
            user_id: userId,
            event_type: auditService.EVENT_TYPES.MFA_FAILED,
            created_at: { [Op.gte]: new Date(Date.now() - FAILURE_WINDOW_MS) },
        },
    });
    if (failures >= FAILURE_LIMIT) throw new TooManyAttemptsError();
}

// Checks an authenticator code, or a recovery code when `allowRecovery`.
// Returns 'totp' or 'recovery'; throws when neither matches. Every miss is
// logged, and the log is what the per-user limit counts.
async function verify(
    userId,
    { code, recovery_code } = {},
    req = null,
    { allowRecovery = true } = {}
) {
    const mfa = await findMfa(userId);
    if (!mfa) throw new ValidationError('Two-factor sign-in is not on');

    await assertNotLockedOut(userId);

    if (code) {
        const step = totp.verifyCode(
            secretCipher.decrypt(mfa.secret_encrypted),
            code,
            { afterStep: mfa.last_used_step }
        );
        if (step !== null) {
            // Only one request may spend a given step.
            const [updated] = await UserMfa.update(
                { last_used_step: step },
                {
                    where: {
                        id: mfa.id,
                        [Op.or]: [
                            { last_used_step: null },
                            { last_used_step: { [Op.lt]: step } },
                        ],
                    },
                }
            );
            if (updated === 1) return 'totp';
        }
    } else if (recovery_code && allowRecovery) {
        const given = normalizeRecoveryCode(recovery_code);
        const unused = await UserRecoveryCode.findAll({
            where: { user_id: userId, used_at: null },
        });
        for (const row of unused) {
            if (given && (await bcrypt.compare(given, row.code_hash))) {
                const [updated] = await UserRecoveryCode.update(
                    { used_at: new Date() },
                    { where: { id: row.id, used_at: null } }
                );
                if (updated === 1) {
                    await logMfaEvent(
                        userId,
                        auditService.EVENT_TYPES.MFA_RECOVERY_CODE_USED,
                        req
                    );
                    notify(await User.findByPk(userId), 'recoveryCodeUsed');
                    return 'recovery';
                }
            }
        }
    }

    await logMfaEvent(userId, auditService.EVENT_TYPES.MFA_FAILED, req);
    throw new InvalidCodeError();
}

function assertMayUse(user) {
    if (!user.email) {
        throw new ForbiddenError(
            'Add an email address to the account before turning on two-factor sign-in.'
        );
    }
    if (!secretCipher.hasKeyMaterial()) {
        throw new ValidationError(
            'Two-factor sign-in needs TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) to be set on the server.'
        );
    }
}

// Step one of turning 2FA on. The secret waits in the session until a code
// from it is confirmed, so an abandoned setup leaves nothing behind.
async function startSetup(user, session) {
    assertMayUse(user);
    if (await isEnabled(user.id)) {
        throw new ValidationError('Two-factor sign-in is already on');
    }
    const secret = totp.generateSecret();
    session.mfaSetup = { secret, at: Date.now() };
    const otpauthUrl = totp.otpauthUri(secret, {
        issuer: ISSUER,
        account: user.email,
    });
    const qrSvg = await QRCode.toString(otpauthUrl, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
    });
    return { secret, otpauth_url: otpauthUrl, qr_svg: qrSvg };
}

async function enable(user, session, code, req, { sessionId = null } = {}) {
    assertMayUse(user);
    const setup = session.mfaSetup;
    if (!setup || Date.now() - setup.at > SETUP_TTL_MS) {
        delete session.mfaSetup;
        throw new ValidationError('Setup expired. Start again.');
    }
    const step = totp.verifyCode(setup.secret, code);
    if (step === null) throw new InvalidCodeError();

    const codes = await sequelize.transaction(async (transaction) => {
        const existing = await UserMfa.findOne({
            where: { user_id: user.id },
            transaction,
        });
        if (existing) {
            throw new ValidationError('Two-factor sign-in is already on');
        }
        await UserMfa.create(
            {
                user_id: user.id,
                secret_encrypted: secretCipher.encrypt(setup.secret),
                last_used_step: step,
                enabled_at: new Date(),
            },
            { transaction }
        );
        return replaceRecoveryCodes(user.id, transaction);
    });

    delete session.mfaSetup;
    // Whoever is signed in elsewhere had only the password.
    await destroyUserSessions(user.id, { exceptSid: sessionId });
    await logMfaEvent(user.id, auditService.EVENT_TYPES.MFA_ENABLED, req);
    notify(user, 'mfaEnabled');
    return { recovery_codes: codes };
}

// Turning 2FA off always takes a fresh code, whatever the step-up window says.
async function disable(user, body, req) {
    await verify(user.id, body, req);
    await sequelize.transaction(async (transaction) => {
        await UserRecoveryCode.destroy({
            where: { user_id: user.id },
            transaction,
        });
        await UserMfa.destroy({ where: { user_id: user.id }, transaction });
    });
    await logMfaEvent(user.id, auditService.EVENT_TYPES.MFA_DISABLED, req);
    notify(user, 'mfaDisabled');
    return { enabled: false };
}

async function regenerateRecoveryCodes(user, req) {
    if (!(await isEnabled(user.id))) {
        throw new ValidationError('Two-factor sign-in is not on');
    }
    const codes = await sequelize.transaction((transaction) =>
        replaceRecoveryCodes(user.id, transaction)
    );
    await logMfaEvent(
        user.id,
        auditService.EVENT_TYPES.MFA_RECOVERY_CODES_REGENERATED,
        req
    );
    notify(user, 'recoveryCodesRegenerated');
    return { recovery_codes: codes };
}

// An admin clears 2FA for someone locked out. Who may do it for whom is
// checked by the caller (admin service).
async function reset(targetUserId, actorUserId, req) {
    const removed = await sequelize.transaction(async (transaction) => {
        await UserRecoveryCode.destroy({
            where: { user_id: targetUserId },
            transaction,
        });
        return UserMfa.destroy({
            where: { user_id: targetUserId },
            transaction,
        });
    });
    if (!removed) return { reset: false };
    await destroyUserSessions(targetUserId);
    await logMfaEvent(targetUserId, auditService.EVENT_TYPES.MFA_RESET, req, {
        reset_by: actorUserId,
    });
    notify(await User.findByPk(targetUserId), 'mfaReset');
    return { reset: true };
}

module.exports = {
    InvalidCodeError,
    TooManyAttemptsError,
    isEnabled,
    getStatus,
    verify,
    startSetup,
    enable,
    disable,
    regenerateRecoveryCodes,
    reset,
    generateRecoveryCode,
    normalizeRecoveryCode,
    FAILURE_LIMIT,
};
