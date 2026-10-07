const path = require('path');
const { execFileSync } = require('child_process');
const { Issuer } = require('openid-client');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const oidcService = require('../../../../modules/oidc/service');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const stateManager = require('../../../../modules/oidc/stateManager');

jest.mock('../../../../modules/oidc/providerConfig', () => ({
    ...jest.requireActual('../../../../modules/oidc/providerConfig'),
    getProvider: jest.fn(),
}));
jest.mock('../../../../modules/oidc/stateManager');

const ISSUER = 'https://id.example.test';
const provider = {
    slug: 'company',
    issuer: ISSUER,
    clientId: 'client',
    clientSecret: 'secret',
    scope: 'openid email',
};

// Bearer access tokens: Jest maps the ESM-only jose package to a stub, so
// the options handed to jwtVerify are checked here, and the real signature,
// issuer, audience and algorithm checks run in a plain Node process
// (tests/helpers/oidcRealTokenCheck.js) with tokens signed by a generated
// key. The ID token and refresh helpers, discovery failures and missing
// providers use a stub client.
describe('OIDC service: tokens', () => {
    beforeEach(() => {
        oidcService.clearIssuerCache();
        jest.replaceProperty(process, 'env', {
            ...process.env,
            OIDC_ISSUER_URL: ISSUER,
            OIDC_ACCESS_TOKEN_AUDIENCE: 'tududi-api, tududi-mcp',
        });
        jest.spyOn(Issuer, 'discover').mockResolvedValue({
            jwks_uri: 'https://id.example.test/jwks',
        });
        createRemoteJWKSet.mockReturnValue('key-set');
        jwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validateAccessToken', () => {
        it('verifies against the provider key set, issuer, audience and asymmetric algorithms only', async () => {
            const payload = await oidcService.validateAccessToken('token');

            expect(payload).toEqual({ sub: 'user-1' });
            expect(createRemoteJWKSet).toHaveBeenCalledWith(
                new URL('https://id.example.test/jwks')
            );
            const [token, keySet, options] = jwtVerify.mock.calls[0];
            expect(token).toBe('token');
            expect(keySet).toBe('key-set');
            expect(options.issuer).toBe(ISSUER);
            expect(options.audience).toEqual(['tududi-api', 'tududi-mcp']);
            expect(options.algorithms.length).toBeGreaterThan(0);
            expect(
                options.algorithms.filter((alg) => /^HS|^none$/i.test(alg))
            ).toEqual([]);
        });

        it('discovers the key set once', async () => {
            await oidcService.validateAccessToken('a');
            await oidcService.validateAccessToken('b');
            expect(Issuer.discover).toHaveBeenCalledTimes(1);
            expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
        });

        it('passes a verification failure on', async () => {
            jwtVerify.mockRejectedValue(
                new Error('signature verification failed')
            );
            await expect(
                oidcService.validateAccessToken('bad')
            ).rejects.toThrow('signature verification failed');
        });

        it('accepts any audience without a setting, and warns once', async () => {
            process.env.OIDC_ACCESS_TOKEN_AUDIENCE = '';
            const warn = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await oidcService.validateAccessToken('a');
            await oidcService.validateAccessToken('b');

            expect(jwtVerify.mock.calls[0][2].audience).toBeUndefined();
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it('refuses everything when no issuer is configured', async () => {
            delete process.env.OIDC_ISSUER_URL;
            await expect(
                oidcService.validateAccessToken('token')
            ).rejects.toThrow('OIDC_ISSUER_URL is not configured');
            expect(jwtVerify).not.toHaveBeenCalled();
        });

        it('with real signatures, accepts only a valid token', () => {
            const output = execFileSync(
                process.execPath,
                [
                    path.join(
                        __dirname,
                        '../../../helpers/oidcRealTokenCheck.js'
                    ),
                ],
                {
                    env: { ...process.env, NODE_ENV: 'test' },
                    encoding: 'utf8',
                    timeout: 60000,
                }
            );
            const line = output
                .split('\n')
                .find((l) => l.startsWith('RESULT '));
            expect(JSON.parse(line.slice('RESULT '.length))).toEqual({
                valid: true,
                wrongAudience: false,
                wrongIssuer: false,
                wrongKey: false,
                expired: false,
                sharedSecret: false,
                algNone: false,
            });
        });
    });

    describe('provider helpers', () => {
        let client;

        beforeEach(() => {
            client = {
                validateIdToken: jest.fn(async () => ({
                    claims: () => ({ sub: 'id-sub' }),
                })),
                refresh: jest.fn(async () => ({
                    access_token: 'new-access',
                    refresh_token: 'new-refresh',
                    expires_at: 123,
                })),
                callback: jest.fn(async () => ({
                    claims: () => ({ sub: 's' }),
                })),
            };
            Issuer.discover.mockResolvedValue({
                Client: jest.fn(() => client),
            });
            providerConfig.getProvider.mockResolvedValue(provider);
        });

        it('validates an ID token with the provider client', async () => {
            expect(
                await oidcService.validateIdToken(
                    'id.token',
                    'nonce',
                    'company'
                )
            ).toEqual({ sub: 'id-sub' });
            expect(client.validateIdToken).toHaveBeenCalledWith(
                { id_token: 'id.token' },
                'nonce'
            );
        });

        it('refreshes an access token', async () => {
            expect(
                await oidcService.refreshAccessToken('company', 'old-refresh')
            ).toEqual({
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
                expiresAt: 123,
            });
        });

        it.each([
            ['initiateAuthFlow', ['missing']],
            ['handleCallback', ['missing', { state: 's' }, 'b']],
            ['validateIdToken', ['token', 'nonce', 'missing']],
            ['refreshAccessToken', ['missing', 'refresh']],
        ])('%s refuses a provider that is not configured', async (fn, args) => {
            providerConfig.getProvider.mockResolvedValue(null);
            await expect(oidcService[fn](...args)).rejects.toThrow(
                'OIDC provider not found: missing'
            );
        });

        it('reuses a discovered provider and reports a discovery failure', async () => {
            await oidcService.discoverProvider(provider);
            await oidcService.discoverProvider(provider);
            expect(Issuer.discover).toHaveBeenCalledTimes(1);

            oidcService.clearIssuerCache();
            Issuer.discover.mockRejectedValue(new Error('offline'));
            jest.spyOn(console, 'error').mockImplementation(() => {});
            await expect(
                oidcService.discoverProvider(provider)
            ).rejects.toThrow('OIDC provider discovery failed: offline');
        });

        it('builds the callback address from the default base', () => {
            delete process.env.BASE_URL;
            expect(oidcService.getRedirectUri('company')).toBe(
                'http://localhost:3002/api/oidc/callback/company'
            );
            expect(
                oidcService.getRedirectUri('company', 'https://app.example')
            ).toBe('https://app.example/api/oidc/callback/company');
        });

        describe('handleCallback', () => {
            beforeEach(() => {
                stateManager.consumeState.mockResolvedValue(true);
                stateManager.bindingMatches.mockReturnValue(true);
            });

            it('refuses a state started for another provider', async () => {
                stateManager.validateState.mockResolvedValue({
                    providerSlug: 'other',
                    nonce: 'n',
                });
                await expect(
                    oidcService.handleCallback('company', { state: 's' }, 'b')
                ).rejects.toThrow('State provider mismatch');
            });

            it('exchanges the code without a verifier for an old state', async () => {
                stateManager.validateState.mockResolvedValue({
                    providerSlug: 'company',
                    nonce: 'n',
                    codeVerifier: null,
                });

                await oidcService.handleCallback(
                    'company',
                    { state: 's', code: 'c' },
                    'b'
                );

                expect(client.callback).toHaveBeenCalledWith(
                    expect.any(String),
                    { state: 's', code: 'c' },
                    { nonce: 'n', state: 's', code_verifier: undefined }
                );
            });
        });
    });
});
