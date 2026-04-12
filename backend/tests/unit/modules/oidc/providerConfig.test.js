const providerConfig = require('../../../../modules/oidc/providerConfig');

describe('OIDC Provider Configuration', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        providerConfig.reloadProviders();
    });

    afterEach(() => {
        process.env = originalEnv;
        providerConfig.reloadProviders();
    });

    describe('when OIDC is disabled', () => {
        it('should return empty array when OIDC_ENABLED is not true', () => {
            process.env.OIDC_ENABLED = 'false';
            providerConfig.reloadProviders();

            const providers = providerConfig.getAllProviders();
            expect(providers).toEqual([]);
            expect(providerConfig.isOidcEnabled()).toBe(false);
        });

        it('should return empty array when OIDC_ENABLED is not set', () => {
            delete process.env.OIDC_ENABLED;
            providerConfig.reloadProviders();

            const providers = providerConfig.getAllProviders();
            expect(providers).toEqual([]);
            expect(providerConfig.isOidcEnabled()).toBe(false);
        });
    });

    describe('single provider configuration', () => {
        it('should load single provider from .env', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-client-id';
            process.env.OIDC_CLIENT_SECRET = 'test-client-secret';

            providerConfig.reloadProviders();
            const providers = providerConfig.getAllProviders();

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

        it('should use default slug if not provided', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Custom Provider';
            process.env.OIDC_ISSUER_URL = 'https://auth.example.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const provider = providerConfig.getProvider('default');

            expect(provider).toBeDefined();
            expect(provider.slug).toBe('default');
        });

        it('should parse custom scope', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Okta';
            process.env.OIDC_PROVIDER_SLUG = 'okta';
            process.env.OIDC_ISSUER_URL = 'https://company.okta.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_SCOPE = 'openid profile email groups';

            providerConfig.reloadProviders();
            const provider = providerConfig.getProvider('okta');

            expect(provider.scope).toBe('openid profile email groups');
        });

        it('should parse admin email domains', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_ADMIN_EMAIL_DOMAINS = 'example.com,company.com';

            providerConfig.reloadProviders();
            const provider = providerConfig.getProvider('google');

            expect(provider.adminEmailDomains).toEqual([
                'example.com',
                'company.com',
            ]);
        });

        it('should respect AUTO_PROVISION=false', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Okta';
            process.env.OIDC_PROVIDER_SLUG = 'okta';
            process.env.OIDC_ISSUER_URL = 'https://company.okta.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';
            process.env.OIDC_AUTO_PROVISION = 'false';

            providerConfig.reloadProviders();
            const provider = providerConfig.getProvider('okta');

            expect(provider.autoProvision).toBe(false);
        });

        it('should return empty array if configuration is incomplete', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';

            providerConfig.reloadProviders();
            const providers = providerConfig.getAllProviders();

            expect(providers).toEqual([]);
        });
    });

    describe('multiple provider configuration', () => {
        it('should load multiple numbered providers', () => {
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
            const providers = providerConfig.getAllProviders();

            expect(providers).toHaveLength(2);
            expect(providers[0].slug).toBe('google');
            expect(providers[1].slug).toBe('okta');
        });

        it('should skip numbered providers with incomplete config', () => {
            process.env.OIDC_ENABLED = 'true';

            process.env.OIDC_PROVIDER_1_NAME = 'Google';
            process.env.OIDC_PROVIDER_1_SLUG = 'google';

            process.env.OIDC_PROVIDER_2_NAME = 'Okta';
            process.env.OIDC_PROVIDER_2_SLUG = 'okta';
            process.env.OIDC_PROVIDER_2_ISSUER = 'https://company.okta.com';
            process.env.OIDC_PROVIDER_2_CLIENT_ID = 'okta-id';
            process.env.OIDC_PROVIDER_2_CLIENT_SECRET = 'okta-secret';

            providerConfig.reloadProviders();
            const providers = providerConfig.getAllProviders();

            expect(providers).toHaveLength(1);
            expect(providers[0].slug).toBe('okta');
        });

        it('should handle different settings per provider', () => {
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

            const google = providerConfig.getProvider('google');
            const corp = providerConfig.getProvider('corp');

            expect(google.autoProvision).toBe(true);
            expect(google.adminEmailDomains).toEqual([]);

            expect(corp.autoProvision).toBe(false);
            expect(corp.adminEmailDomains).toEqual(['corp.com']);
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

        it('should return provider by slug', () => {
            const provider = providerConfig.getProvider('google');
            expect(provider).toBeDefined();
            expect(provider.slug).toBe('google');
        });

        it('should return null for non-existent slug', () => {
            const provider = providerConfig.getProvider('nonexistent');
            expect(provider).toBeNull();
        });
    });

    describe('isOidcEnabled', () => {
        it('should return true when OIDC is enabled with valid provider', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            expect(providerConfig.isOidcEnabled()).toBe(true);
        });

        it('should return false when OIDC_ENABLED is false', () => {
            process.env.OIDC_ENABLED = 'false';
            providerConfig.reloadProviders();
            expect(providerConfig.isOidcEnabled()).toBe(false);
        });

        it('should return false when no providers configured', () => {
            process.env.OIDC_ENABLED = 'true';
            providerConfig.reloadProviders();
            expect(providerConfig.isOidcEnabled()).toBe(false);
        });
    });

    describe('provider caching', () => {
        it('should cache providers after first load', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const providers1 = providerConfig.getAllProviders();

            process.env.OIDC_PROVIDER_NAME = 'Changed';

            const providers2 = providerConfig.getAllProviders();

            expect(providers1).toBe(providers2);
            expect(providers2[0].name).toBe('Google');
        });

        it('should reload providers when reloadProviders is called', () => {
            process.env.OIDC_ENABLED = 'true';
            process.env.OIDC_PROVIDER_NAME = 'Google';
            process.env.OIDC_PROVIDER_SLUG = 'google';
            process.env.OIDC_ISSUER_URL = 'https://accounts.google.com';
            process.env.OIDC_CLIENT_ID = 'test-id';
            process.env.OIDC_CLIENT_SECRET = 'test-secret';

            providerConfig.reloadProviders();
            const providers1 = providerConfig.getAllProviders();

            process.env.OIDC_PROVIDER_NAME = 'Changed';
            providerConfig.reloadProviders();

            const providers2 = providerConfig.getAllProviders();

            expect(providers1).not.toBe(providers2);
            expect(providers2[0].name).toBe('Changed');
        });
    });
});
