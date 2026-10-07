const configService = require('../../../../modules/oidc/configService');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const { Setting } = require('../../../../models');

const sampleProvider = (overrides = {}) => ({
    slug: 'google',
    name: 'Google',
    issuer: 'https://accounts.google.com',
    clientId: 'client-id',
    clientSecret: 'super-secret',
    scope: 'openid profile email',
    autoProvision: true,
    adminEmailDomains: [],
    ...overrides,
});

describe('OIDC configService', () => {
    let originalEnv;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        process.env.TUDUDI_SESSION_SECRET = 'x'.repeat(64);
        delete process.env.TUDUDI_OIDC_SECRET_ENCRYPTION_KEY;
        await Setting.destroy({ where: { key: 'oidc_config' } });
        providerConfig.reloadProviders();
    });

    afterEach(async () => {
        process.env = originalEnv;
        await Setting.destroy({ where: { key: 'oidc_config' } });
        providerConfig.reloadProviders();
    });

    describe('getMaskedConfig', () => {
        it('reports source "env" and never returns a usable secret when no row exists', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';

            const config = await configService.getMaskedConfig();

            expect(config.source).toBe('env');
            expect(config.providers).toHaveLength(1);
            const provider = config.providers[0];
            expect(provider.client_secret_set).toBe(true);
            expect(provider.client_secret_last4).toBe('cret');
            expect(provider.clientSecret).toBeUndefined();
            expect(JSON.stringify(config)).not.toContain('env-secret');
        });

        it('reports source "db" once a config has been saved', async () => {
            await configService.saveConfig({
                enabled: true,
                providers: [sampleProvider()],
            });

            const config = await configService.getMaskedConfig();
            expect(config.source).toBe('db');
            expect(config.providers[0].client_secret_set).toBe(true);
            expect(JSON.stringify(config)).not.toContain('super-secret');
        });
    });

    describe('saveConfig', () => {
        it('round-trips a provider so the OIDC flow can use the decrypted secret', async () => {
            await configService.saveConfig({
                enabled: true,
                providers: [sampleProvider()],
            });

            const dbConfig = await configService.getDbConfig();
            expect(dbConfig.enabled).toBe(true);
            expect(dbConfig.providers[0].clientSecret).toBe('super-secret');
        });

        it('stores the secret encrypted, not in plaintext', async () => {
            await configService.saveConfig({
                enabled: true,
                providers: [sampleProvider()],
            });

            const row = await Setting.findOne({
                where: { key: 'oidc_config' },
            });
            expect(row.value).not.toContain('super-secret');
        });

        it('preserves the stored secret when a later save omits clientSecret', async () => {
            await configService.saveConfig({
                enabled: true,
                providers: [sampleProvider()],
            });

            await configService.saveConfig({
                enabled: true,
                providers: [
                    sampleProvider({
                        name: 'Google Workspace',
                        clientSecret: undefined,
                    }),
                ],
            });

            const dbConfig = await configService.getDbConfig();
            expect(dbConfig.providers[0].name).toBe('Google Workspace');
            expect(dbConfig.providers[0].clientSecret).toBe('super-secret');
        });

        it('carries a matching .env secret over on the first save when clientSecret is omitted', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';

            await configService.saveConfig({
                enabled: true,
                providers: [
                    sampleProvider({
                        clientId: 'env-id',
                        clientSecret: undefined,
                    }),
                ],
            });

            const dbConfig = await configService.getDbConfig();
            expect(dbConfig.providers[0].clientSecret).toBe('env-secret');
        });

        it('rejects a new provider with no clientSecret and nothing to carry over', async () => {
            await expect(
                configService.saveConfig({
                    enabled: true,
                    providers: [sampleProvider({ clientSecret: undefined })],
                })
            ).rejects.toThrow(/missing a client secret/);
        });

        it('refuses to save a secret with no encryption key material available', async () => {
            delete process.env.TUDUDI_SESSION_SECRET;
            delete process.env.TUDUDI_OIDC_SECRET_ENCRYPTION_KEY;

            await expect(
                configService.saveConfig({
                    enabled: true,
                    providers: [sampleProvider()],
                })
            ).rejects.toThrow(/Cannot save an OIDC client secret/);
        });

        it('invalidates the providerConfig cache so the new config takes effect immediately', async () => {
            process.env.OIDC_ENABLED = 'false';
            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(false);

            await configService.saveConfig({
                enabled: true,
                providers: [sampleProvider()],
            });

            expect(await providerConfig.isOidcEnabled()).toBe(true);
            expect(await providerConfig.getProvider('google')).toMatchObject({
                clientSecret: 'super-secret',
            });
        });
    });
});
