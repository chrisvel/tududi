'use strict';

// Life-to-Day (T-701, T-702): settings of the embedded OAuth 2.1 server for
// remote MCP clients (blueprint 17.3, ADR-008). Off unless
// LTD_OAUTH_ENABLED=true; issuer is BASE_URL, the protected resource is
// exactly <BASE_URL>/api/mcp.
const SCOPES = ['ltd.read', 'ltd.write', 'ltd.propose'];

// DCR accepts only these redirect URIs (blueprint 17.3).
const REDIRECT_ALLOWLIST = [
    /^https:\/\/claude\.ai\/api\/mcp\/auth_callback$/,
    /^https:\/\/claude\.com\/api\/mcp\/auth_callback$/,
    // Claude Code and other local clients: loopback on any port.
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/[^\s#]*$/,
    /^https:\/\/chatgpt\.com\/connector_platform_oauth_redirect$/,
    /^https:\/\/chatgpt\.com\/connector\/oauth\/[\w-]+$/,
];

const enabled = () =>
    (process.env.LTD_OAUTH_ENABLED || '').toLowerCase() === 'true';
const base = () => (process.env.BASE_URL || '').replace(/\/+$/, '');
const resource = () => `${base()}/api/mcp`;
const metadataUrl = () =>
    `${base()}/.well-known/oauth-protected-resource/api/mcp`;
const isMcpPath = (req) => req.originalUrl.split('?')[0] === '/api/mcp';
const allowedRedirect = (uri) =>
    typeof uri === 'string' && REDIRECT_ALLOWLIST.some((re) => re.test(uri));

// RFC 9728 challenge on 401; Claude ignores it on 200.
const challenge = (error) =>
    [
        `Bearer resource_metadata="${metadataUrl()}"`,
        `scope="${SCOPES.join(' ')}"`,
        ...(error ? [`error="${error}"`] : []),
    ].join(', ');

const resourceMetadata = () => ({
    resource: resource(),
    authorization_servers: [base()],
    scopes_supported: SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Life-to-Day',
});

module.exports = {
    SCOPES,
    enabled,
    base,
    resource,
    metadataUrl,
    isMcpPath,
    allowedRedirect,
    challenge,
    resourceMetadata,
};
