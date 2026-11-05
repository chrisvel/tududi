'use strict';

const { getConfig } = require('../../config/config');
const { isAdmin } = require('../../services/rolesService');
const mfaService = require('../mfa/service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

// Self-hosted admins stay opt-in, so an upgrade never locks anyone out.
async function requireSuperadminMfa(req, res, next) {
    try {
        if (getConfig().hosted?.enabled !== true) return next();
        const userId = getAuthenticatedUserId(req);
        if (!userId || !(await isAdmin(userId))) return next();
        if (await mfaService.isEnabled(userId)) return next();
        return res.status(403).json({
            error: 'Turn on two-factor sign-in in Profile > Security to use the admin panel.',
            mfa_setup_required: true,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { requireSuperadminMfa };
