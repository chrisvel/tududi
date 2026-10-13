'use strict';

// Runs outside Jest (which maps the ESM-only jose package to a stub) so the
// bearer token check in modules/oidc/service.js is exercised with real
// signatures. Serves a generated public key as a JWKS, signs tokens that are
// right or wrong in one way each, and prints which ones validateAccessToken
// accepted. Used by tests/unit/modules/oidc/service-tokens.test.js.

const http = require('http');
const { Issuer } = require('openid-client');
const { SignJWT, exportJWK, generateKeyPair } = require('jose');

const ISSUER = 'https://id.example.test';

async function main() {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };

    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const jwksUri = `http://127.0.0.1:${server.address().port}/jwks`;
    Issuer.discover = async () => ({ jwks_uri: jwksUri });

    process.env.OIDC_ISSUER_URL = ISSUER;
    process.env.OIDC_ACCESS_TOKEN_AUDIENCE = 'tududi-api';
    const { validateAccessToken } = require('../../modules/oidc/service');

    const sign = (overrides = {}) =>
        new SignJWT({})
            .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
            .setIssuer(overrides.issuer || ISSUER)
            .setAudience(overrides.audience || 'tududi-api')
            .setSubject('user-1')
            .setExpirationTime(overrides.expires || '5m')
            .sign(overrides.key || privateKey);

    const unsigned = (header) =>
        [
            Buffer.from(JSON.stringify(header)).toString('base64url'),
            Buffer.from(
                JSON.stringify({
                    iss: ISSUER,
                    aud: 'tududi-api',
                    sub: 'user-1',
                    exp: Math.floor(Date.now() / 1000) + 300,
                })
            ).toString('base64url'),
            '',
        ].join('.');

    const cases = {
        valid: await sign(),
        wrongAudience: await sign({ audience: 'other-app' }),
        wrongIssuer: await sign({ issuer: 'https://evil.example' }),
        wrongKey: await sign({ key: other.privateKey }),
        expired: await sign({ expires: Math.floor(Date.now() / 1000) - 60 }),
        sharedSecret: await new SignJWT({})
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer(ISSUER)
            .setAudience('tududi-api')
            .setExpirationTime('5m')
            .sign(new TextEncoder().encode('a-shared-secret-of-32-bytes!!!!!')),
        algNone: unsigned({ alg: 'none' }),
    };

    const accepted = {};
    for (const [name, token] of Object.entries(cases)) {
        try {
            const payload = await validateAccessToken(token);
            accepted[name] = payload.sub === 'user-1';
        } catch {
            accepted[name] = false;
        }
    }

    server.close();
    process.stdout.write(`RESULT ${JSON.stringify(accepted)}\n`);
    process.exit(0);
}

main().catch((error) => {
    process.stderr.write(String(error && error.stack));
    process.exit(1);
});
