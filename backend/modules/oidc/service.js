const { Issuer, generators } = require('openid-client');
const providerConfig = require('./providerConfig');
const stateManager = require('./stateManager');

const issuerCache = new Map();

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

async function initiateAuthFlow(providerSlug, linkMode = false) {
    const config = providerConfig.getProvider(providerSlug);
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

    const { state, nonce } = await stateManager.createState(
        providerSlug,
        linkMode ? 'link' : null
    );

    const authUrl = client.authorizationUrl({
        scope: config.scope,
        state,
        nonce,
    });

    return { authUrl, state, nonce };
}

async function handleCallback(providerSlug, callbackParams) {
    const config = providerConfig.getProvider(providerSlug);
    if (!config) {
        throw new Error(`OIDC provider not found: ${providerSlug}`);
    }

    const stateData = await stateManager.validateState(callbackParams.state);

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
        }
    );

    await stateManager.consumeState(callbackParams.state);

    const claims = tokenSet.claims();

    return {
        claims,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        idToken: tokenSet.id_token,
        linkMode: stateData.redirectUri === 'link',
    };
}

async function validateIdToken(idToken, nonce, providerSlug) {
    const config = providerConfig.getProvider(providerSlug);
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
    const config = providerConfig.getProvider(providerSlug);
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

function clearIssuerCache() {
    issuerCache.clear();
}

module.exports = {
    discoverProvider,
    initiateAuthFlow,
    handleCallback,
    validateIdToken,
    refreshAccessToken,
    getRedirectUri,
    clearIssuerCache,
};
