jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
}));

const configService = require('../../../../modules/oidc/configService');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const secretCipher = require('../../../../shared/crypto/secretCipher');
const { logError } = require('../../../../services/logService');
const { Setting } = require('../../../../models');

const storeRow = (value) =>
    Setting.upsert({ key: 'oidc_config', value: JSON.stringify(value) });

// The single sign-on settings when the stored row is odd or unreadable,
// when a provider leaves optional fields out, and when the environment
// describes a provider only partly.
describe('OIDC config edge cases', () => {
    beforeEach(async () => {
        await Setting.destroy({ where: { key: 'oidc_config' } });
        providerConfig.reloadProviders();
        jest.replaceProperty(process, 'env', {
            ...process.env,
            TUDUDI_SESSION_SECRET: 'a-session-secret-for-tests-only',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        providerConfig.reloadProviders();
    });

    describe('reading the stored row', () => {
        it('falls back when the settings table cannot be read', async () => {
            jest.spyOn(Setting, 'findOne').mockRejectedValue(new Error('x'));
            expect(await configService.getDbConfig()).toBeNull();
            expect(logError).toHaveBeenCalled();
        });

        it('reads a row without a provider list as no providers', async () => {
            await storeRow({ enabled: true, providers: 'oops' });
            expect(await configService.getDbConfig()).toEqual({
                enabled: true,
                providers: [],
            });
        });

        it('falls back when a stored secret cannot be decrypted', async () => {
            await storeRow({
                enabled: true,
                providers: [{ slug: 'g', clientSecret: 'not-encrypted' }],
            });
            jest.spyOn(secretCipher, 'decrypt').mockImplementation(() => {
                throw new Error('bad key');
            });
            expect(await configService.getDbConfig()).toBeNull();
        });
    });

    describe('the masked view', () => {
        it('shows a missing or short secret without its last characters', async () => {
            jest.spyOn(secretCipher, 'decrypt').mockImplementation((v) => v);
            await storeRow({
                enabled: true,
                providers: [
                    { slug: 'none', name: 'None' },
                    { slug: 'short', name: 'Short', clientSecret: 'abc' },
                ],
            });

            const { providers } = await configService.getMaskedConfig();

            expect(providers[0]).toEqual(
                expect.objectContaining({
                    client_secret_set: false,
                    client_secret_last4: null,
                    adminEmailDomains: [],
                })
            );
            expect(providers[1]).toEqual(
                expect.objectContaining({
                    client_secret_set: true,
                    client_secret_last4: null,
                })
            );
        });
    });

    describe('saving', () => {
        it('keeps the trust setting it is given and defaults the admin domains', async () => {
            await configService.saveConfig({
                enabled: true,
                providers: [
                    {
                        slug: 'company',
                        name: 'Company',
                        issuer: 'https://id.example',
                        clientId: 'client',
                        clientSecret: 'secret-value',
                        scope: 'openid email',
                        autoProvision: true,
                        trustUnverifiedEmail: true,
                    },
                ],
            });

            const row = await Setting.findOne({
                where: { key: 'oidc_config' },
            });
            const [stored] = JSON.parse(row.value).providers;
            expect(stored.trustUnverifiedEmail).toBe(true);
            expect(stored.adminEmailDomains).toEqual([]);
        });
    });

    describe('providerConfig', () => {
        it('skips an environment provider without a slug', async () => {
            jest.replaceProperty(process, 'env', {
                ...process.env,
                OIDC_ENABLED: 'true',
                OIDC_PROVIDER_1_ISSUER: 'https://id.example',
                OIDC_PROVIDER_1_CLIENT_ID: 'client',
                OIDC_PROVIDER_1_CLIENT_SECRET: 'secret',
                OIDC_PROVIDER_1_SLUG: '',
                OIDC_PROVIDER_1_NAME: 'Company',
            });
            jest.spyOn(console, 'warn').mockImplementation(() => {});

            expect(providerConfig.loadProvidersFromEnv()).toEqual([]);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringMatching(
                    /missing required fields: OIDC_PROVIDER_1_SLUG$/
                )
            );
        });

        it('falls back to the environment when the stored config throws', async () => {
            jest.spyOn(configService, 'getDbConfig').mockRejectedValue(
                new Error('db gone')
            );
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.replaceProperty(process, 'env', {
                ...process.env,
                OIDC_ENABLED: 'false',
            });

            expect(await providerConfig.isOidcEnabled()).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });
});
