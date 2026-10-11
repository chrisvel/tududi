'use strict';

/**
 * Who may change what is installed on the server.
 *
 * Enabling a plugin is a per-user choice, but installing one writes code into
 * the app that every account then loads with its own session. That is an
 * operator decision, so it is restricted to an admin - with one exception, and
 * it is the same exception user management makes: an instance whose roles table
 * is still empty would otherwise be unable to install anything at all, because
 * nobody is an admin yet.
 *
 * A hosted instance never gets that exception: its roles table being empty
 * would hand plugin installation to whoever asked first.
 */

const { Role } = require('../../models');
const rolesService = require('../../services/rolesService');
const entitlements = require('../../services/entitlementsService');

const AppError = require('../../shared/errors/AppError');

async function canManagePlugins(user) {
    if (!user || !user.uid) return false;
    if (await rolesService.isAdmin(user.uid)) return true;

    if (entitlements.isHostedMode()) return false;
    return (await Role.count()) === 0;
}

/**
 * What a token may not do: stand in for a person.
 *
 * A personal API token with no abilities has full access to the API by design,
 * and an OIDC access token is a session by another name; neither is a person
 * deciding to run new code on this server, or to be handed the whole of a
 * plugin directory. Both are identifiable by the Authorization header, which a
 * browser session never sends.
 *
 * `what` is the work being refused, and it goes into the message a client sees.
 */
const assertNotTokenAuthenticated = (req, what) => {
    const authorization = req.headers && req.headers.authorization;
    const viaToken =
        Boolean(req.authToken) ||
        (typeof authorization === 'string' &&
            authorization.toLowerCase().startsWith('bearer '));

    if (viaToken) {
        throw new AppError(
            `${what} requires a signed-in session rather than an API token.`,
            403,
            'FORBIDDEN'
        );
    }
};

const requirePluginManager = async (req, res, next) => {
    try {
        assertNotTokenAuthenticated(req, 'Installing plugins');
        if (!(await canManagePlugins(req.currentUser))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    canManagePlugins,
    assertNotTokenAuthenticated,
    requirePluginManager,
};
