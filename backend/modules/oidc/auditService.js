const { AuthAuditLog } = require('../../models');

const EVENT_TYPES = {
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILED: 'login_failed',
    LOGOUT: 'logout',
    OIDC_LINKED: 'oidc_linked',
    OIDC_UNLINKED: 'oidc_unlinked',
    OIDC_PROVISION: 'oidc_provision',
};

const AUTH_METHODS = {
    EMAIL_PASSWORD: 'email_password',
    OIDC: 'oidc',
    API_TOKEN: 'api_token',
};

async function logEvent({
    userId = null,
    eventType,
    authMethod,
    providerSlug = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
}) {
    try {
        await AuthAuditLog.create({
            user_id: userId,
            event_type: eventType,
            auth_method: authMethod,
            provider_slug: providerSlug,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: metadata ? JSON.stringify(metadata) : null,
        });
    } catch (error) {
        console.error('Failed to log auth event:', error);
    }
}

async function logLoginSuccess(userId, authMethod, req, providerSlug = null) {
    return logEvent({
        userId,
        eventType: EVENT_TYPES.LOGIN_SUCCESS,
        authMethod,
        providerSlug,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
    });
}

async function logLoginFailed(
    email,
    authMethod,
    req,
    providerSlug = null,
    reason = null
) {
    return logEvent({
        userId: null,
        eventType: EVENT_TYPES.LOGIN_FAILED,
        authMethod,
        providerSlug,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: { email, reason },
    });
}

async function logLogout(userId, req) {
    return logEvent({
        userId,
        eventType: EVENT_TYPES.LOGOUT,
        authMethod: AUTH_METHODS.EMAIL_PASSWORD,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
    });
}

async function logOidcLinked(userId, providerSlug, req) {
    return logEvent({
        userId,
        eventType: EVENT_TYPES.OIDC_LINKED,
        authMethod: AUTH_METHODS.OIDC,
        providerSlug,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
    });
}

async function logOidcUnlinked(userId, providerSlug, req) {
    return logEvent({
        userId,
        eventType: EVENT_TYPES.OIDC_UNLINKED,
        authMethod: AUTH_METHODS.OIDC,
        providerSlug,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
    });
}

async function logOidcProvision(userId, providerSlug, req, isNewUser) {
    return logEvent({
        userId,
        eventType: EVENT_TYPES.OIDC_PROVISION,
        authMethod: AUTH_METHODS.OIDC,
        providerSlug,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: { isNewUser },
    });
}

async function getRecentEvents(userId, limit = 50) {
    return AuthAuditLog.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit,
    });
}

async function cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deletedCount = await AuthAuditLog.destroy({
        where: {
            created_at: {
                [require('sequelize').Op.lt]: cutoffDate,
            },
        },
    });

    return deletedCount;
}

module.exports = {
    EVENT_TYPES,
    AUTH_METHODS,
    logEvent,
    logLoginSuccess,
    logLoginFailed,
    logLogout,
    logOidcLinked,
    logOidcUnlinked,
    logOidcProvision,
    getRecentEvents,
    cleanupOldLogs,
};
