'use strict';

// Life-to-Day (T-701): the token signing key. Generated once and kept in a
// file beside the database (a Docker volume in production) so tokens stay
// valid across restarts. Never commit this file.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../../config/config');

const keyFile = () =>
    process.env.LTD_OAUTH_JWKS_FILE ||
    path.join(path.dirname(getConfig().dbFile), 'ltd-oauth-jwks.json');

let cached;

function generate(file) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    const jwk = privateKey.export({ format: 'jwk' });
    const kid = crypto
        .createHash('sha256')
        .update(jwk.n)
        .digest('base64url')
        .slice(0, 16);
    const jwks = { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
        // 'wx': a second process starting at the same time keeps the first key.
        fs.writeFileSync(file, JSON.stringify(jwks), {
            mode: 0o600,
            flag: 'wx',
        });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

// Private JWKS for oidc-provider.
function signingKeys() {
    if (cached) return cached;
    const file = keyFile();
    if (!fs.existsSync(file)) generate(file);
    cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    return cached;
}

// Public part only, for verifying access tokens.
const publicKeys = () => ({
    // eslint-disable-next-line no-unused-vars
    keys: signingKeys().keys.map(({ d, p, q, dp, dq, qi, ...pub }) => pub),
});

module.exports = { signingKeys, publicKeys, keyFile };
