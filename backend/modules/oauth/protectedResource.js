'use strict';

/**
 * Serves the OAuth 2.0 Protected Resource Metadata document (RFC 9728).
 *
 * Registered at /.well-known/oauth-protected-resource before requireAuth.
 * Only active when OIDC_ENABLED=true, OIDC_ISSUER_URL and BASE_URL are set.
 */
// LTD-PATCH(T-702): with LTD_OAUTH_ENABLED the resource is /api/mcp and the
// authorization server is the embedded one (blueprint 17.3).
const ltdOauth = require('../ltd-oauth/config');

function handleProtectedResource(req, res) {
    if (ltdOauth.enabled()) {
        return res.json(ltdOauth.resourceMetadata());
    }
    const issuerUrl = process.env.OIDC_ISSUER_URL?.replace(/\/$/, ''); // trim trailing slash
    if (
        !issuerUrl ||
        (process.env.OIDC_ENABLED || '').toLowerCase() !== 'true'
    ) {
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
