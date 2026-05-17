'use strict';

/**
 * Serves the OAuth 2.0 Protected Resource Metadata document (RFC 9728).
 *
 * Registered at /.well-known/oauth-protected-resource before requireAuth.
 * Only active when OIDC_ENABLED=true, OIDC_ISSUER_URL and BASE_URL are set.
 */
function handleProtectedResource(req, res) {
    const issuerUrl = process.env.OIDC_ISSUER_URL?.replace(/\/$/, ''); // trim trailing slash
    if (!issuerUrl || process.env.OIDC_ENABLED !== 'true') {
        return res.status(404).end();
    }

    const resource = process.env.BASE_URL?.replace(/\/$/, ''); // trim trailing slash
    if (!resource) {
        return res.status(404).end();
    }

    return res.json({
        resource,
        authorization_servers: [issuerUrl],
        scopes_supported: ['openid', 'email', 'profile'],
    });
}

module.exports = { handleProtectedResource };
