const providerConfig = require('../../../../modules/oidc/providerConfig');
const { Setting } = require('../../../../models');

async function clearDbConfig() {
    await Setting.destroy({ where: { key: 'oidc_config' } });
}

describe('OIDC Provider Configuration', () => {
    let originalEnv;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        await clearDbConfig();
        providerConfig.reloadProviders();
    });

    afterEach(async () => {
        process.env = originalEnv;
        await clearDbConfig();
        providerConfig.reloadProviders();
    });

    describe('when OIDC is disabled', () => {
        it('should return empty array when OIDC_ENABLED is not true', async () => {
            process.env.OIDC_ENABLED = 'false';
            providerConfig.reloadProviders();

            const providers = await providerConfig.getAllProviders();
            expect(providers).toEqual([]);
            expect(await providerConfig.isOidcEnabled()).toBe(false);
        });

        it('should return empty array when OIDC_ENABLED is not set', async () => {
            delete process.env.OIDC_ENABLED;
            providerConfig.reloadProviders();

            const providers = await providerConfig.getAllProviders();
            expect(providers).toEqual([]);
            expect(await providerConfig.isOidcEnabled()).toBe(false);
        });
    });

    describe('OIDC_ENABLED case-insensitivity', () => {
        const validProvider = () => {
            process.env.OIDC_PROVIDER_NAME = 'TestProvider';
            process.env.OIDC_PROVIDER_SLUG = 'test';
            process.env.OIDC_ISSUER_URL = 'https://idp.example.com';
            process.env.OIDC_CLIENT_ID = 'client123';
            process.env.OIDC_CLIENT_SECRET = 'secret123';
        };

        afterEach(() => {
            delete process.env.OIDC_PROVIDER_NAME;
            delete process.env.OIDC_PROVIDER_SLUG;
            delete process.env.OIDC_ISSUER_URL;
            delete process.env.OIDC_CLIENT_ID;
            delete process.env.OIDC_CLIENT_SECRET;
        });

        it('should enable OIDC when OIDC_ENABLED is "True" (docker-compose v1 YAML boolean)', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();
            validProvider();
            process.env.OIDC_ENABLED = 'True';
            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(true);
            consoleLogSpy.mockRestore();
        });

        it('should enable OIDC when OIDC_ENABLED is "TRUE"', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();
            validProvider();
            process.env.OIDC_ENABLED = 'TRUE';
            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(true);
            consoleLogSpy.mockRestore();
        });
    });

    describe('single provider configuration', () => {
        it('should load single provider from .env', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-client-id';
            process.env.OIDC_CLIENT_SECRET = 'test-client-secret';

            providerConfig.reloadProviders();
            const providers = await providerConfig.getAllProviders();

            expect(providers).toHaveLength(1);
            expect(providers[0]).toMatchObject({
                slug: 'google',
                name: 'Google',
                issuer: 'https://accounts.google.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                scope: 'openid profile email',
                autoProvision: true,
            });
        });

        it('should use default slug if not provided', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Custom Provider';
            process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('default');

            expect(provider).toBeDefined();
            expect(provider.slug).toBe('default');
        });

        it('should parse custom scope', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Okta';
            process.env.OIDC_PROVIDER_SLUG = 'okta';
            process.env.OIDC_ISSUER_URL = 'https://company.okta.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_SCOPE = 'openid profile email groups';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('okta');

            expect(provider.scope).toBe('openid profile email groups');
        });

        it('should normalize scope with extra whitespace', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Test';
            process.env.OIDC_PROVIDER_SLUG = 'test';
            process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_SCOPE = '  openid   profile    email  ';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('test');

            expect(provider.scope).toBe('openid profile email');
        });

        it('should add openid scope if missing', async () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Test';
            process.env.OIDC_PROVIDER_SLUG = 'test';
            process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_SCOPE = 'profile email';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('test');

            expect(provider.scope).toBe('openid profile email');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("does not include 'openid'")
            );

            consoleWarnSpy.mockRestore();
        });

        it('should handle scope with tabs and newlines', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Test';
            process.env.OIDC_PROVIDER_SLUG = 'test';
            process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_SCOPE = 'openid\tprofile\nemail';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('test');

            expect(provider.scope).toBe('openid profile email');
        });

        it('should parse admin email domains', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_ADMIN_EMAIL_DOMAINS = 'example.com,company.com';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('google');

            expect(provider.adminEmailDomains).toEqual([
                'example.com',
                'company.com',
            ]);
        });

        it('should respect AUTO_PROVISION=false', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Okta';
            process.env.OIDC_PROVIDER_SLUG = 'okta';
            process.env.OIDC_ISSUER_URL = 'https://company.okta.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_AUTO_PROVISION = 'false';

            providerConfig.reloadProviders();
            const provider = await providerConfig.getProvider('okta');

            expect(provider.autoProvision).toBe(false);
        });

        it('should return empty array if configuration is incomplete', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';

            providerConfig.reloadProviders();
            const providers = await providerConfig.getAllProviders();

            expect(providers).toEqual([]);
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot load provider')
            );

            consoleLogSpy.mockRestore();
        });
    });

    describe('multiple provider configuration', () => {
        it('should load multiple numbered providers', async () => {
            process.env.OIDC_ENABLED = 'true';

            process.env.OIDC_PROVIDER_1_NAME = 'Google';
            process.env.OIDC_PROVIDER_1_SLUG = 'google';
            process.env.OIDC_PROVIDER_1_ISSUER = 'https://accounts.google.com';
            process.env.OIDC_PROVIDER_1_CLIENT_ID = 'google-id';
            process.env.OIDC_PROVIDER_1_CLIENT_SECRET = 'google-secret';

            process.env.OIDC_PROVIDER_2_NAME = 'Okta';
            process.env.OIDC_PROVIDER_2_SLUG = 'okta';
            process.env.OIDC_PROVIDER_2_ISSUER = 'https://company.okta.com';
            process.env.OIDC_PROVIDER_2_CLIENT_ID = 'okta-id';
            process.env.OIDC_PROVIDER_2_CLIENT_SECRET = 'okta-secret';

            providerConfig.reloadProviders();
            const providers = await providerConfig.getAllProviders();

            expect(providers).toHaveLength(2);
            expect(providers[0].slug).toBe('google');
            expect(providers[1].slug).toBe('okta');
        });

        it('should skip numbered providers with incomplete config', async () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation();
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'true';

            process.env.OIDC_PROVIDER_1_NAME = 'Google';
            process.env.OIDC_PROVIDER_1_SLUG = 'google';

            process.env.OIDC_PROVIDER_2_NAME = 'Okta';
            process.env.OIDC_PROVIDER_2_SLUG = 'okta';
            process.env.OIDC_PROVIDER_2_ISSUER = 'https://company.okta.com';
            process.env.OIDC_PROVIDER_2_CLIENT_ID = 'okta-id';
            process.env.OIDC_PROVIDER_2_CLIENT_SECRET = 'okta-secret';

            providerConfig.reloadProviders();
            const providers = await providerConfig.getAllProviders();

            expect(providers).toHaveLength(1);
            expect(providers[0].slug).toBe('okta');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping OIDC provider 1')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Loaded OIDC provider 2: Okta')
            );

            consoleWarnSpy.mockRestore();
            consoleLogSpy.mockRestore();
        });

        it('should handle different settings per provider', async () => {
            process.env.OIDC_ENABLED = 'true';

            process.env.OIDC_PROVIDER_1_NAME = 'Google';
            process.env.OIDC_PROVIDER_1_SLUG = 'google';
            process.env.OIDC_PROVIDER_1_ISSUER = 'https://accounts.google.com';
            process.env.OIDC_PROVIDER_1_CLIENT_ID = 'google-id';
            process.env.OIDC_PROVIDER_1_CLIENT_SECRET = 'google-secret';
            process.env.OIDC_PROVIDER_1_AUTO_PROVISION = 'true';

            process.env.OIDC_PROVIDER_2_NAME = 'Corporate';
            process.env.OIDC_PROVIDER_2_SLUG = 'corp';
            process.env.OIDC_PROVIDER_2_ISSUER = 'https://auth.corp.com';
            process.env.OIDC_PROVIDER_2_CLIENT_ID = 'corp-id';
            process.env.OIDC_PROVIDER_2_CLIENT_SECRET = 'corp-secret';
            process.env.OIDC_PROVIDER_2_AUTO_PROVISION = 'false';
            process.env.OIDC_PROVIDER_2_ADMIN_EMAIL_DOMAINS = 'corp.com';

            providerConfig.reloadProviders();

            const google = await providerConfig.getProvider('google');
            const corp = await providerConfig.getProvider('corp');

            expect(google.autoProvision).toBe(true);
            expect(google.adminEmailDomains).toEqual([]);

            expect(corp.autoProvision).toBe(false);
            expect(corp.adminEmailDomains).toEqual(['corp.com']);
        });

        it('should normalize scopes in multi-provider configuration', async () => {
            process.env.OIDC_ENABLED = 'true';

            process.env.OIDC_PROVIDER_1_NAME = 'Google';
            process.env.OIDC_PROVIDER_1_SLUG = 'google';
            process.env.OIDC_PROVIDER_1_ISSUER = 'https://accounts.google.com';
            process.env.OIDC_PROVIDER_1_CLIENT_ID = 'google-id';
            process.env.OIDC_PROVIDER_1_CLIENT_SECRET = 'google-secret';
            process.env.OIDC_PROVIDER_1_SCOPE = '  openid  profile  email  ';

            process.env.OIDC_PROVIDER_2_NAME = 'Okta';
            process.env.OIDC_PROVIDER_2_SLUG = 'okta';
            process.env.OIDC_PROVIDER_2_ISSUER = 'https://company.okta.com';
            process.env.OIDC_PROVIDER_2_CLIENT_ID = 'okta-id';
            process.env.OIDC_PROVIDER_2_CLIENT_SECRET = 'okta-secret';
            process.env.OIDC_PROVIDER_2_SCOPE = 'openid profile email groups';

            providerConfig.reloadProviders();

            const google = await providerConfig.getProvider('google');
            const okta = await providerConfig.getProvider('okta');

            expect(google.scope).toBe('openid profile email');
            expect(okta.scope).toBe('openid profile email groups');
        });
    });

    describe('getProvider', () => {
        beforeEach(() => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            providerConfig.reloadProviders();
        });

        it('should return provider by slug', async () => {
            const provider = await providerConfig.getProvider('google');
            expect(provider).toBeDefined();
            expect(provider.slug).toBe('google');
        });

        it('should return null for non-existent slug', async () => {
            const provider = await providerConfig.getProvider('nonexistent');
            expect(provider).toBeNull();
        });
    });

    describe('isOidcEnabled', () => {
        it('should return true when OIDC is enabled with valid provider', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(true);

            consoleLogSpy.mockRestore();
        });

        it('should return false when OIDC_ENABLED is false', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'false';
            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(false);

            consoleLogSpy.mockRestore();
        });

        it('should return false when no providers configured', async () => {
            const consoleLogSpy = jest
                .spyOn(console, 'log')
                .mockImplementation();

            process.env.OIDC_ENABLED = 'true';
            providerConfig.reloadProviders();
            expect(await providerConfig.isOidcEnabled()).toBe(false);
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Enabled but no valid providers configured'
                )
            );

            consoleLogSpy.mockRestore();
        });
    });

    describe('provider caching', () => {
        it('should cache providers after first load', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const providers1 = await providerConfig.getAllProviders();

            process.env.OIDC_PROVIDER_NAME = 'Changed';

            const providers2 = await providerConfig.getAllProviders();

            expect(providers1).toBe(providers2);
            expect(providers2[0].name).toBe('Google');
        });

        it('should reload providers when reloadProviders is called', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const providers1 = await providerConfig.getAllProviders();

            process.env.OIDC_PROVIDER_NAME = 'Changed';
            providerConfig.reloadProviders();

            const providers2 = await providerConfig.getAllProviders();

            expect(providers1).not.toBe(providers2);
            expect(providers2[0].name).toBe('Changed');
        });

        it('should not re-query the database within the cache TTL', async () => {
            const findOneSpy = jest.spyOn(Setting, 'findOne');

            await providerConfig.getAllProviders();
            const callsAfterFirst = findOneSpy.mock.calls.length;
            await providerConfig.getAllProviders();
            const callsAfterSecond = findOneSpy.mock.calls.length;

            expect(callsAfterSecond).toBe(callsAfterFirst);

            providerConfig.reloadProviders();
            await providerConfig.getAllProviders();
            expect(findOneSpy.mock.calls.length).toBeGreaterThan(
                callsAfterSecond
            );

            findOneSpy.mockRestore();
        });
    });

    describe('database-backed configuration', () => {
        it('lets a DB row win over a fully configured .env', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'EnvProvider';
            process.env.OIDC_PROVIDER_SLUG = 'env-provider';
            process.env.OIDC_ISSUER_URL = 'https://env.example.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';

            await Setting.upsert({
                key: 'oidc_config',
                value: JSON.stringify({
                    enabled: true,
                    providers: [
                        {
                            slug: 'db-provider',
                            name: 'DBProvider',
                            issuer: 'https://db.example.com',
                            clientId: 'db-id',
                            clientSecret: 'db-secret',
                            scope: 'openid profile email',
                            autoProvision: true,
                            adminEmailDomains: [],
                        },
                    ],
                }),
            });
            providerConfig.reloadProviders();

            const providers = await providerConfig.getAllProviders();
            expect(providers).toHaveLength(1);
            expect(providers[0].slug).toBe('db-provider');
            expect(await providerConfig.getProvider('env-provider')).toBeNull();
        });

        it('falls back to .env when no DB row exists', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'EnvProvider';
            process.env.OIDC_PROVIDER_SLUG = 'env-provider';
            process.env.OIDC_ISSUER_URL = 'https://env.example.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';
            providerConfig.reloadProviders();

            const providers = await providerConfig.getAllProviders();
            expect(providers).toHaveLength(1);
            expect(providers[0].slug).toBe('env-provider');
        });

        it('turns OIDC off when the DB row is disabled, even with .env fully configured', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'EnvProvider';
            process.env.OIDC_PROVIDER_SLUG = 'env-provider';
            process.env.OIDC_ISSUER_URL = 'https://env.example.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';

            await Setting.upsert({
                key: 'oidc_config',
                value: JSON.stringify({ enabled: false, providers: [] }),
            });
            providerConfig.reloadProviders();

            expect(await providerConfig.getAllProviders()).toEqual([]);
            expect(await providerConfig.isOidcEnabled()).toBe(false);
        });

        it('falls back to .env when the stored row is not valid JSON', async () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'EnvProvider';
            process.env.OIDC_PROVIDER_SLUG = 'env-provider';
            process.env.OIDC_ISSUER_URL = 'https://env.example.com';
            process.env.OIDC_CLIENT_ID = 'env-id';
            process.env.OIDC_CLIENT_SECRET = 'env-secret';

            await Setting.upsert({ key: 'oidc_config', value: 'not-json' });
            providerConfig.reloadProviders();

            const providers = await providerConfig.getAllProviders();
            expect(providers).toHaveLength(1);
            expect(providers[0].slug).toBe('env-provider');
        });
    });
});
