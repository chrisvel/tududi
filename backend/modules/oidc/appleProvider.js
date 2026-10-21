'use strict';

const crypto = require('crypto');

// Sign in with Apple is OpenID Connect with three differences the generic
// provider cannot express: the client secret is a short-lived JWT signed with
// a private key from the Apple developer account, the callback arrives as a
// form POST when name or email is requested, and the user's name is sent once,
// on the first sign-in, outside the ID token. It is configured with its own
// variables, apart from the OIDC_* list and the admin OIDC panel, so saving
// that panel never drops it.
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_SLUG = 'apple';
// Apple accepts a client secret valid for up to six months; a day is plenty
// for a value that is re-signed whenever it runs out.
const CLIENT_SECRET_TTL_SECONDS = 24 * 60 * 60;

let secretCache = null; // { cacheKey, secret, expiresAt }

function isAppleProvider(config) {
    return !!config && config.issuer === APPLE_ISSUER;
}

// Env files cannot hold a multi-line value everywhere, so the PEM may come
// with its line breaks written as \n.
function readPrivateKey(value) {
    if (!value) return null;
    return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function loadAppleProviderFromEnv() {
    const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
    if (!clientId) return null;

    const provider = {
        slug: APPLE_SLUG,
        name: 'Apple',
        issuer: APPLE_ISSUER,
        clientId,
        teamId: process.env.APPLE_SIGN_IN_TEAM_ID,
        keyId: process.env.APPLE_SIGN_IN_KEY_ID,
        privateKey: readPrivateKey(process.env.APPLE_SIGN_IN_PRIVATE_KEY),
        scope: 'openid name email',
        autoProvision: true,
        adminEmailDomains: [],
        trustUnverifiedEmail: false,
    };

    const missingFields = [];
    if (!provider.teamId) missingFields.push('APPLE_SIGN_IN_TEAM_ID');
    if (!provider.keyId) missingFields.push('APPLE_SIGN_IN_KEY_ID');
    if (!provider.privateKey) missingFields.push('APPLE_SIGN_IN_PRIVATE_KEY');

    if (missingFields.length > 0) {
        console.warn(
            `[OIDC] Sign in with Apple is not loaded: missing ${missingFields.join(', ')}`
        );
        return null;
    }

    return provider;
}

function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

// An ES256 JWT signed with the .p8 key from the Apple developer account.
function signClientSecret(config, issuedAt, expiresAt) {
    const signingInput = [
        base64UrlJson({ alg: 'ES256', kid: config.keyId }),
        base64UrlJson({
            iss: config.teamId,
            iat: issuedAt,
            exp: expiresAt,
            aud: APPLE_ISSUER,
            sub: config.clientId,
        }),
    ].join('.');
    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
        key: crypto.createPrivateKey(config.privateKey),
        dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${signature.toString('base64url')}`;
}

async function getClientSecret(config) {
    const cacheKey = crypto
        .createHash('sha256')
        .update(
            [config.clientId, config.teamId, config.keyId, config.privateKey]
                .map(String)
                .join('\0')
        )
        .digest('hex');
    const now = Math.floor(Date.now() / 1000);

    // Re-signed a minute before it runs out, so a token request never
    // carries a secret that expires in flight.
    if (
        secretCache &&
        secretCache.cacheKey === cacheKey &&
        secretCache.expiresAt - 60 > now
    ) {
        return secretCache.secret;
    }

    const expiresAt = now + CLIENT_SECRET_TTL_SECONDS;
    const secret = signClientSecret(config, now, expiresAt);

    secretCache = { cacheKey, secret, expiresAt };
    return secret;
}

// The `user` form field Apple posts on the first sign-in only:
// {"name":{"firstName":"..","lastName":".."},"email":".."}. It is not signed,
// so only the name is taken from it, and only as given_name/family_name for
// an account that has no name yet. The email always comes from the ID token.
function namesFromUserParam(value) {
    if (typeof value !== 'string' || !value) return {};

    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch (_) {
        return {};
    }

    const clip = (part) =>
        typeof part === 'string' && part.trim()
            ? part.trim().slice(0, 255)
            : undefined;
    const names = {};
    const given = clip(parsed?.name?.firstName);
    const family = clip(parsed?.name?.lastName);
    if (given) names.given_name = given;
    if (family) names.family_name = family;
    return names;
}

function clearClientSecretCache() {
    secretCache = null;
}

module.exports = {
    APPLE_ISSUER,
    APPLE_SLUG,
    isAppleProvider,
    loadAppleProviderFromEnv,
    getClientSecret,
    namesFromUserParam,
    clearClientSecretCache,
};
