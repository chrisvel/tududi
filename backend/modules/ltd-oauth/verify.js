'use strict';

// Life-to-Day (T-702): accepts an access token from the embedded AS on
// /api/mcp only: RS256 with our key, typ at+jwt, iss = BASE_URL,
// aud = <BASE_URL>/api/mcp, a live grant for that client, and ltd.read.
const { User } = require('../../models');
const { publicKeys } = require('./keys');
const { hasGrant } = require('./store');
const { SCOPES, base, resource } = require('./config');

let jwks;

async function verifyAccessToken(token) {
    if (token.split('.').length !== 3) return null;
    const { jwtVerify, createLocalJWKSet } = await import('jose');
    jwks ||= createLocalJWKSet(publicKeys());
    let payload;
    try {
        ({ payload } = await jwtVerify(token, jwks, {
            issuer: base(),
            audience: resource(),
            algorithms: ['RS256'],
            typ: 'at+jwt',
        }));
    } catch {
        return null;
    }
    // A revoked client (Settings or kill switch) loses its grant at once,
    // even while its signed token has not expired yet.
    if (!payload.client_id || !(await hasGrant(payload.sub, payload.client_id)))
        return null;
    const scopes = String(payload.scope || '')
        .split(' ')
        .filter((scope) => SCOPES.includes(scope));
    if (!scopes.includes('ltd.read')) return { error: 'insufficient_scope' };
    const user = await User.findByPk(Number(payload.sub));
    if (!user) return null;
    return {
        user,
        claims: { client_id: payload.client_id, scopes, iat: payload.iat },
    };
}

module.exports = { verifyAccessToken };
