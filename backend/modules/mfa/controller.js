'use strict';

const { User } = require('../../models');
const mfaService = require('./service');
const mfaSession = require('./session');
const auditService = require('../oidc/auditService');
const { InvalidCodeError } = mfaService;
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError, ValidationError } = require('../../shared/errors');

async function currentUser(req) {
    const userId = getAuthenticatedUserId(req);
    const user = userId ? await User.findByPk(userId) : null;
    if (!user) throw new UnauthorizedError('Authentication required');
    return user;
}

const controller = {
    // POST /api/login/mfa: the second step of a sign-in.
    async completeLogin(req, res, next) {
        try {
            const pending = mfaSession.getPendingLogin(req.session);
            if (!pending) {
                return res.status(401).json({
                    error: 'Sign-in timed out. Please sign in again.',
                    mfa_expired: true,
                });
            }

            try {
                await mfaService.verify(pending.userId, req.body || {}, req);
            } catch (error) {
                if (error.code === 'INVALID_CODE') {
                    await mfaSession.countFailedTry(req.session);
                    const left = req.session.pendingMfa
                        ? mfaSession.PENDING_MAX_TRIES -
                          req.session.pendingMfa.tries
                        : 0;
                    return res.status(401).json({
                        error: error.message,
                        mfa_expired: left === 0,
                    });
                }
                throw error;
            }

            const user = await User.findByPk(pending.userId);
            if (!user) {
                return res
                    .status(401)
                    .json({ error: 'Invalid credentials', mfa_expired: true });
            }

            await mfaSession.signIn(req, user);
            await auditService.logLoginSuccess(
                user.id,
                pending.method === 'oidc'
                    ? auditService.AUTH_METHODS.OIDC
                    : auditService.AUTH_METHODS.EMAIL_PASSWORD,
                req,
                pending.providerSlug
            );

            const authService = require('../auth/service');
            res.json(await authService.buildLoginResult(user));
        } catch (error) {
            next(error);
        }
    },

    async status(req, res, next) {
        try {
            const user = await currentUser(req);
            res.json(await mfaService.getStatus(user.id));
        } catch (error) {
            next(error);
        }
    },

    async startSetup(req, res, next) {
        try {
            const user = await currentUser(req);
            const result = await mfaService.startSetup(user, req.session);
            await mfaSession.save(req.session);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async enable(req, res, next) {
        try {
            const user = await currentUser(req);
            const result = await mfaService.enable(
                user,
                req.session,
                req.body?.code,
                req,
                { sessionId: req.sessionID }
            );
            mfaSession.markReverified(req.session);
            await mfaSession.save(req.session);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async disable(req, res, next) {
        try {
            const user = await currentUser(req);
            res.json(await mfaService.disable(user, req.body || {}, req));
        } catch (error) {
            next(error);
        }
    },

    async regenerateRecoveryCodes(req, res, next) {
        try {
            const user = await currentUser(req);
            res.json(await mfaService.regenerateRecoveryCodes(user, req));
        } catch (error) {
            next(error);
        }
    },

    // POST /api/auth/reverify: type the code (2FA on) or the password again
    // to open the step-up window.
    async reverify(req, res, next) {
        try {
            const user = await currentUser(req);
            const { password, code, recovery_code } = req.body || {};
            if (await mfaService.isEnabled(user.id)) {
                await mfaService.verify(user.id, { code, recovery_code }, req);
            } else if (user.password_digest) {
                if (typeof password !== 'string' || !password) {
                    throw new ValidationError('Password is required');
                }
                if (
                    !(await User.checkPassword(password, user.password_digest))
                ) {
                    throw new InvalidCodeError('Password is incorrect');
                }
            } else {
                throw new ValidationError('Nothing to confirm');
            }
            if (req.session) {
                mfaSession.markReverified(req.session);
                await mfaSession.save(req.session);
            }
            res.json({ verified: true });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = controller;
