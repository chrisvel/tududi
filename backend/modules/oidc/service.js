const { Issuer, generators } = require('openid-client');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const providerConfig = require('./providerConfig');
const stateManager = require('./stateManager');
const { OidcUserError } = require('./errors');

const issuerCache = new Map();
let jwksCache = null;
let warnedAboutAudience = false;

// Asymmetric algorithms only: the JWKS holds public keys, so an HMAC or
// "none" token must never verify.
const ACCESS_TOKEN_ALGORITHMS = [
    'RS256',
    'RS384',
    'RS512',
    'PS256',
    'PS384',
    'PS512',
    'ES256',
    'ES384',
    'ES512',
    'EdDSA',
];

async function discoverProvider(config) {
    if (issuerCache.has(config.issuer)) {
        return issuerCache.get(config.issuer);
    }

    try {
        const issuer = await Issuer.discover(config.issuer);
        issuerCache.set(config.issuer, issuer);
        return issuer;
    } catch (error) {
        console.error(
            `Failed to discover OIDC provider at ${config.issuer}:`,
            error.message
        );
        throw new Error(`OIDC provider discovery failed: ${error.message}`);
    }
}

function getRedirectUri(providerSlug, baseUrl) {
    const base = baseUrl || process.env.BASE_URL || 'http://localhost:3002';
    return `${base}/api/oidc/callback/${providerSlug}`;
}

// userId is the signed-in user starting an account-link flow; it is recorded
// with the state so the callback can refuse to attach the identity to anyone
// else. bindingToken must be handed to the browser as a cookie: the callback
// only accepts the state from the browser that started the flow.
async function initiateAuthFlow(providerSlug, linkMode = false, userId = null) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`OIDC provider not found: ${providerSlug}`);
    }

    const issuer = await discoverProvider(config);

    const client = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [getRedirectUri(providerSlug)],
        response_types: ['code'],
    });

    const codeVerifier = generators.codeVerifier();

    const { state, nonce, bindingToken } = await stateManager.createState(
        providerSlug,
        linkMode ? 'link' : null,
        { userId: linkMode ? userId : null, codeVerifier }
    );

    const authUrl = client.authorizationUrl({
        scope: config.scope,
        state,
        nonce,
        code_challenge: generators.codeChallenge(codeVerifier),
        code_challenge_method: 'S256',
    });

    return { authUrl, state, nonce, bindingToken };
}

async function handleCallback(providerSlug, callbackParams, bindingToken) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`OIDC provider not found: ${providerSlug}`);
    }

    const stateData = await stateManager.validateState(callbackParams.state);

    // A state is good for one attempt, whatever the outcome: consume it before
    // anything else so a failed or replayed callback cannot be retried.
    const consumed = await stateManager.consumeState(callbackParams.state);
    if (!consumed) {
        throw new Error('Invalid state parameter');
    }

    if (!stateManager.bindingMatches(stateData.bindingHash, bindingToken)) {
        throw new OidcUserError(
            'Sign-in session mismatch. Please start again from the login page.'
        );
    }

    if (stateData.providerSlug !== providerSlug) {
        throw new Error('State provider mismatch');
    }

    const issuer = await discoverProvider(config);

    const client = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [getRedirectUri(providerSlug)],
        response_types: ['code'],
    });

    const tokenSet = await client.callback(
        getRedirectUri(providerSlug),
        callbackParams,
        {
            nonce: stateData.nonce,
            state: callbackParams.state,
            code_verifier: stateData.codeVerifier || undefined,
        }
    );

    const idTokenClaims = tokenSet.claims();

    let claims = { ...idTokenClaims };
    if (tokenSet.access_token) {
        try {
            const userInfoClaims = await client.userinfo(tokenSet.access_token);
            // UserInfo supplements missing claims; ID token claims take precedence
            // for security-critical fields like sub
            claims = { ...userInfoClaims, ...idTokenClaims };
        } catch (userInfoError) {
            console.warn(
                'Failed to fetch UserInfo claims, using ID token claims only:',
                userInfoError.message
            );
        }
    }

    return {
        claims,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        idToken: tokenSet.id_token,
        linkMode: stateData.redirectUri === 'link',
        linkUserId: stateData.userId,
    };
}

async function validateIdToken(idToken, nonce, providerSlug) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`OIDC provider not found: ${providerSlug}`);
    }

    const issuer = await discoverProvider(config);

    const client = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
    });

    const tokenSet = await client.validateIdToken({ id_token: idToken }, nonce);
    return tokenSet.claims();
}

async function refreshAccessToken(providerSlug, refreshToken) {
    const config = await providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`OIDC provider not found: ${providerSlug}`);
    }

    const issuer = await discoverProvider(config);

    const client = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
    });

    const tokenSet = await client.refresh(refreshToken);

    return {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at,
    };
}

/**
 * Validates an OAuth2 access token (JWT) issued by the configured OIDC provider.
 * Used by the MCP middleware to authenticate requests from OAuth2 clients.
 * Returns the token payload on success, or throws on failure.
 */
async function validateAccessToken(token) {
    const issuerUrl = process.env.OIDC_ISSUER_URL;
    if (!issuerUrl) {
        throw new Error('OIDC_ISSUER_URL is not configured');
    }

    if (!jwksCache) {
        const issuer = await Issuer.discover(issuerUrl);
        jwksCache = createRemoteJWKSet(new URL(issuer.jwks_uri));
    }

    const verifyOptions = {
        issuer: issuerUrl,
        algorithms: ACCESS_TOKEN_ALGORITHMS,
    };

    // Without an audience, any JWT the provider issued to any client (an ID
    // token, or a token minted for an unrelated app) passes as API access.
    // Setting OIDC_ACCESS_TOKEN_AUDIENCE restricts tokens to this application.
    const audience = providerConfig.parseCommaSeparated(
        process.env.OIDC_ACCESS_TOKEN_AUDIENCE
    );
    if (audience.length > 0) {
        verifyOptions.audience = audience;
    } else if (!warnedAboutAudience) {
        warnedAboutAudience = true;
        console.warn(
            '[OIDC] OIDC_ACCESS_TOKEN_AUDIENCE is not set: bearer tokens are accepted from any audience. Set it to the audience your OAuth clients request.'
        );
    }

    const { payload } = await jwtVerify(token, jwksCache, verifyOptions);

    return payload;
}

function clearIssuerCache() {
    issuerCache.clear();
    jwksCache = null;
    warnedAboutAudience = false;
}

module.exports = {
    discoverProvider,
    initiateAuthFlow,
    handleCallback,
    validateIdToken,
    refreshAccessToken,
    validateAccessToken,
    getRedirectUri,
    clearIssuerCache,
};
