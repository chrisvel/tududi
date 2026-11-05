'use strict';

const { User } = require('../../models');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

// A password (or SSO) sign-in on an account with 2FA leaves the session
// half-signed-in: `pendingMfa` names the user, `userId` stays unset, so
// requireAuth treats it as signed out until the code arrives.
const PENDING_TTL_MS = 5 * 60 * 1000;
const PENDING_MAX_TRIES = 5;
// How long a password or code typed for a sensitive action stays good.
const RECENT_AUTH_MS = 10 * 60 * 1000;

function regenerate(session) {
    return new Promise((resolve, reject) =>
        session.regenerate((err) => (err ? reject(err) : resolve()))
    );
}

function save(session) {
    return new Promise((resolve, reject) =>
        session.save((err) => (err ? reject(err) : resolve()))
    );
}

// A fresh session id for a new sign-in state, so an id planted before
// sign-in never carries over.
// Takes req, not req.session: regenerate puts a new object on req.session.
async function startPendingLogin(req, user, { method, providerSlug = null }) {
    await regenerate(req.session);
    req.session.pendingMfa = {
        userId: user.id,
        at: Date.now(),
        tries: 0,
        method,
        providerSlug,
    };
    await save(req.session);
}

function getPendingLogin(session) {
    const pending = session?.pendingMfa;
    if (!pending) return null;
    if (
        Date.now() - pending.at > PENDING_TTL_MS ||
        pending.tries >= PENDING_MAX_TRIES
    ) {
        delete session.pendingMfa;
        return null;
    }
    return pending;
}

async function countFailedTry(session) {
    const pending = session.pendingMfa;
    if (!pending) return;
    pending.tries += 1;
    if (pending.tries >= PENDING_MAX_TRIES) delete session.pendingMfa;
    await save(session);
}

// `verified` marks a sign-in that checked a password or code, which opens
// the step-up window right away.
async function signIn(req, user, { verified = true } = {}) {
    await regenerate(req.session);
    req.session.userId = user.id;
    if (verified) req.session.reverifiedAt = Date.now();
    await save(req.session);
}

function markReverified(session) {
    session.reverifiedAt = Date.now();
}

function isRecentlyVerified(session) {
    const at = session?.reverifiedAt;
    return typeof at === 'number' && Date.now() - at <= RECENT_AUTH_MS;
}

// Guards a sensitive action: a session must have typed a password or code
// in the last 10 minutes. Answers 403 `reauth_required`, which the web app
// turns into a prompt and a retry. API-token requests carry no session and
// pass, as do accounts with nothing to type (SSO-only, no 2FA).
function requireRecentAuth(req, res, next) {
    (async () => {
        if (!req.session?.userId) return next();
        if (isRecentlyVerified(req.session)) return next();

        const userId = getAuthenticatedUserId(req);
        const { isEnabled } = require('./service');
        const user = await User.findByPk(userId, {
            attributes: ['id', 'password_digest'],
        });
        const mfa = user ? await isEnabled(user.id) : false;
        if (!user || (!mfa && !user.password_digest)) return next();

        return res.status(403).json({
            error: 'Confirm it is you to continue.',
            reauth_required: true,
            method: mfa ? 'code' : 'password',
        });
    })().catch(next);
}

module.exports = {
    PENDING_TTL_MS,
    PENDING_MAX_TRIES,
    RECENT_AUTH_MS,
    regenerate,
    save,
    startPendingLogin,
    getPendingLogin,
    countFailedTry,
    signIn,
    markReverified,
    isRecentlyVerified,
    requireRecentAuth,
};
