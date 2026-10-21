const crypto = require('crypto');
const appleProvider = require('../../../../modules/oidc/appleProvider');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
});
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

const decodePart = (part) =>
    JSON.parse(Buffer.from(part, 'base64url').toString());

const config = {
    issuer: appleProvider.APPLE_ISSUER,
    clientId: 'com.example.tududi.web',
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    privateKey: pem,
};

describe('appleProvider', () => {
    beforeEach(() => {
        appleProvider.clearClientSecretCache();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('loadAppleProviderFromEnv', () => {
        const withEnv = (vars) =>
            jest.replaceProperty(process, 'env', { ...process.env, ...vars });

        it('is off without a client id', () => {
            withEnv({ APPLE_SIGN_IN_CLIENT_ID: '' });
            expect(appleProvider.loadAppleProviderFromEnv()).toBeNull();
        });

        it('is off and names what is missing when the key is incomplete', () => {
            withEnv({
                APPLE_SIGN_IN_CLIENT_ID: 'com.example.web',
                APPLE_SIGN_IN_TEAM_ID: 'TEAM',
                APPLE_SIGN_IN_KEY_ID: '',
                APPLE_SIGN_IN_PRIVATE_KEY: '',
            });
            expect(appleProvider.loadAppleProviderFromEnv()).toBeNull();
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'APPLE_SIGN_IN_KEY_ID, APPLE_SIGN_IN_PRIVATE_KEY'
                )
            );
        });

        it('builds the provider, reading a key written on one line', () => {
            withEnv({
                APPLE_SIGN_IN_CLIENT_ID: 'com.example.web',
                APPLE_SIGN_IN_TEAM_ID: 'TEAM',
                APPLE_SIGN_IN_KEY_ID: 'KEY',
                APPLE_SIGN_IN_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
            });

            const provider = appleProvider.loadAppleProviderFromEnv();

            expect(provider).toMatchObject({
                slug: 'apple',
                name: 'Apple',
                issuer: 'https://appleid.apple.com',
                clientId: 'com.example.web',
                scope: 'openid name email',
                autoProvision: true,
                trustUnverifiedEmail: false,
            });
            expect(provider.privateKey).toBe(pem);
            expect(appleProvider.isAppleProvider(provider)).toBe(true);
        });
    });

    describe('getClientSecret', () => {
        it('signs an ES256 JWT in the shape Apple expects', async () => {
            const secret = await appleProvider.getClientSecret(config);

            const [header, payload, signature] = secret.split('.');

            expect(decodePart(header)).toEqual({
                alg: 'ES256',
                kid: 'KEY1234567',
            });
            expect(
                crypto.verify(
                    'sha256',
                    Buffer.from(`${header}.${payload}`),
                    { key: publicKey, dsaEncoding: 'ieee-p1363' },
                    Buffer.from(signature, 'base64url')
                )
            ).toBe(true);
            const claims = decodePart(payload);
            expect(claims).toMatchObject({
                iss: 'TEAM123456',
                sub: 'com.example.tududi.web',
                aud: 'https://appleid.apple.com',
            });
            expect(claims.exp - claims.iat).toBeLessThanOrEqual(
                180 * 24 * 60 * 60
            );
        });

        it('reuses the secret until the config changes', async () => {
            const first = await appleProvider.getClientSecret(config);
            expect(await appleProvider.getClientSecret(config)).toBe(first);

            const other = await appleProvider.getClientSecret({
                ...config,
                keyId: 'OTHERKEY12',
            });
            expect(other).not.toBe(first);
        });
    });

    describe('namesFromUserParam', () => {
        it('takes the name and leaves the unsigned email behind', () => {
            expect(
                appleProvider.namesFromUserParam(
                    JSON.stringify({
                        name: { firstName: ' Ada ', lastName: 'Lovelace' },
                        email: 'someone-else@example.com',
                    })
                )
            ).toEqual({ given_name: 'Ada', family_name: 'Lovelace' });
        });

        it.each([undefined, '', 'not json', '{}', '{"name":{"firstName":3}}'])(
            'ignores %p',
            (value) => {
                expect(appleProvider.namesFromUserParam(value)).toEqual({});
            }
        );
    });
});
