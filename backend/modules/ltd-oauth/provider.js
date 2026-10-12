'use strict';

// Life-to-Day (T-701): oidc-provider 9.12.2 (ESM, loaded with import()) as
// the authorization server for remote MCP (ADR-008). DCR with a redirect
// allowlist, PKCE S256 only, Resource Indicators with aud = the MCP URL,
// JWT access tokens for one hour, rotating 30-day refresh tokens.
const crypto = require('crypto');
const { User } = require('../../models');
const { getConfig } = require('../../config/config');
const { SequelizeAdapter } = require('./store');
const { signingKeys } = require('./keys');
const { SCOPES, base, resource } = require('./config');

const ACCESS_TOKEN_TTL = 60 * 60;
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

let built;
const getProvider = () => (built ||= build());

async function build() {
    const { default: Provider, errors } = await import('oidc-provider');
    const cookieKey = crypto
        .createHmac('sha256', getConfig().secret)
        .update('ltd-oauth-cookies')
        .digest('hex');
    const provider = new Provider(base(), {
        adapter: SequelizeAdapter,
        jwks: signingKeys(),
        cookies: { keys: [cookieKey] },
        scopes: ['openid', 'offline_access', ...SCOPES],
        claims: { openid: ['sub'] },
        findAccount: async (_ctx, sub) => {
            const user = await User.findByPk(Number(sub));
            return user
                ? { accountId: String(user.id), claims: async () => ({ sub }) }
                : undefined;
        },
        features: {
            devInteractions: { enabled: false },
            registration: { enabled: true },
            revocation: { enabled: true },
            resourceIndicators: {
                enabled: true,
                defaultResource: () => resource(),
                useGrantedResource: () => true,
                getResourceServerInfo: (_ctx, indicator) => {
                    if (indicator !== resource())
                        throw new errors.InvalidTarget();
                    return {
                        scope: SCOPES.join(' '),
                        audience: resource(),
                        accessTokenTTL: ACCESS_TOKEN_TTL,
                        accessTokenFormat: 'jwt',
                        jwt: { sign: { alg: 'RS256' } },
                    };
                },
            },
        },
        pkce: { required: () => true },
        responseTypes: ['code'],
        clientDefaults: {
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        },
        ttl: {
            AccessToken: ACCESS_TOKEN_TTL,
            AuthorizationCode: 60,
            RefreshToken: REFRESH_TOKEN_TTL,
            Grant: REFRESH_TOKEN_TTL,
            Interaction: 600,
            Session: 3600,
        },
        rotateRefreshToken: true,
        // Claude does not always ask for offline_access (and oidc-provider
        // drops it without openid), so every client allowed the
        // refresh_token grant gets a rotating refresh token (G4 finding 2).
        issueRefreshToken: async (_ctx, client) =>
            client.grantTypeAllowed('refresh_token'),
        routes: {
            authorization: '/oauth2/auth',
            token: '/oauth2/token',
            registration: '/oauth2/reg',
            jwks: '/oauth2/jwks',
            revocation: '/oauth2/revoke',
            end_session: '/oauth2/session/end',
            userinfo: '/oauth2/me',
            introspection: '/oauth2/introspect',
            pushed_authorization_request: '/oauth2/par',
        },
        interactions: {
            url: (_ctx, interaction) =>
                `/oauth2/interaction/${interaction.uid}`,
        },
    });
    const trustProxy = getConfig().trustProxy;
    provider.proxy = trustProxy !== false && trustProxy !== undefined;
    return provider;
}

module.exports = { getProvider };
