const { Issuer } = require('openid-client');
const oidcService = require('../../../../modules/oidc/service');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const stateManager = require('../../../../modules/oidc/stateManager');

jest.mock('../../../../modules/oidc/providerConfig');
jest.mock('../../../../modules/oidc/stateManager');

describe('OIDC Service - handleCallback UserInfo integration', () => {
    let originalEnv;
    let mockIssuer;
    let mockClient;

    const mockProvider = {
        slug: 'test-provider',
        name: 'Test Provider',
        issuer: 'https://auth.example.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'openid profile email',
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.BASE_URL = 'https://todo.example.com';

        mockClient = {
            authorizationUrl: jest.fn(),
            callback: jest.fn(),
            userinfo: jest.fn(),
        };

        mockIssuer = {
            Client: jest.fn(() => mockClient),
            metadata: {
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
            },
        };

        jest.spyOn(Issuer, 'discover').mockResolvedValue(mockIssuer);
        providerConfig.getProvider.mockReturnValue(mockProvider);
        stateManager.validateState.mockResolvedValue({
            providerSlug: 'test-provider',
            nonce: 'test-nonce',
            redirectUri: null,
        });
        stateManager.consumeState.mockResolvedValue();

        oidcService.clearIssuerCache();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
        oidcService.clearIssuerCache();
    });

    it('should merge UserInfo claims with ID token claims, ID token taking precedence', async () => {
        mockClient.callback.mockResolvedValue({
            access_token: 'access-token-123',
            id_token: 'id-token-123',
            claims: () => ({
                sub: 'user-sub-123',
                iss: 'https://auth.example.com',
            }),
        });

        mockClient.userinfo.mockResolvedValue({
            sub: 'user-sub-DIFFERENT',
            email: 'user@example.com',
            name: 'Test User',
        });

        const result = await oidcService.handleCallback('test-provider', {
            code: 'auth-code',
            state: 'test-state',
        });

        expect(mockClient.userinfo).toHaveBeenCalledWith('access-token-123');
        expect(result.claims.sub).toBe('user-sub-123');
        expect(result.claims.email).toBe('user@example.com');
        expect(result.claims.name).toBe('Test User');
    });

    it('should use only ID token claims when UserInfo fetch fails', async () => {
        mockClient.callback.mockResolvedValue({
            access_token: 'access-token-123',
            id_token: 'id-token-123',
            claims: () => ({
                sub: 'user-sub-123',
                email: 'fallback@example.com',
            }),
        });

        mockClient.userinfo.mockRejectedValue(
            new Error('UserInfo endpoint unavailable')
        );

        const result = await oidcService.handleCallback('test-provider', {
            code: 'auth-code',
            state: 'test-state',
        });

        expect(result.claims.sub).toBe('user-sub-123');
        expect(result.claims.email).toBe('fallback@example.com');
    });

    it('should skip UserInfo fetch when no access token is present', async () => {
        mockClient.callback.mockResolvedValue({
            id_token: 'id-token-123',
            claims: () => ({ sub: 'user-sub-123', email: 'user@example.com' }),
        });

        const result = await oidcService.handleCallback('test-provider', {
            code: 'auth-code',
            state: 'test-state',
        });

        expect(mockClient.userinfo).not.toHaveBeenCalled();
        expect(result.claims.sub).toBe('user-sub-123');
        expect(result.claims.email).toBe('user@example.com');
    });

    it('should supplement missing email from UserInfo when not in ID token', async () => {
        mockClient.callback.mockResolvedValue({
            access_token: 'access-token-123',
            id_token: 'id-token-123',
            claims: () => ({ sub: 'user-sub-123' }),
        });

        mockClient.userinfo.mockResolvedValue({
            sub: 'user-sub-123',
            email: 'user@authelia.example.com',
            name: 'Authelia User',
        });

        const result = await oidcService.handleCallback('test-provider', {
            code: 'auth-code',
            state: 'test-state',
        });

        expect(result.claims.email).toBe('user@authelia.example.com');
        expect(result.claims.name).toBe('Authelia User');
        expect(result.claims.sub).toBe('user-sub-123');
    });
});

describe('OIDC Service - Authorization URL Construction', () => {
    let originalEnv;
    let mockIssuer;
    let mockClient;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.BASE_URL = 'https://todo.example.com';

        mockClient = {
            authorizationUrl: jest.fn(),
            callback: jest.fn(),
        };

        mockIssuer = {
            Client: jest.fn(() => mockClient),
            metadata: {
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
            },
        };

        jest.spyOn(Issuer, 'discover').mockResolvedValue(mockIssuer);

        oidcService.clearIssuerCache();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
        oidcService.clearIssuerCache();
    });

    describe('initiateAuthFlow with scope containing spaces', () => {
        it('should properly encode scope with spaces in authorization URL', async () => {
            const mockProvider = {
                slug: 'test-provider',
                name: 'Test Provider',
                issuer: 'https://auth.example.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                scope: 'openid profile email',
            };

            providerConfig.getProvider.mockReturnValue(mockProvider);

            stateManager.createState.mockResolvedValue({
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            const mockAuthUrl =
                'https://auth.example.com/authorize?client_id=test-client-id&scope=openid%20profile%20email&response_type=code&redirect_uri=https%3A%2F%2Ftodo.example.com%2Fapi%2Foidc%2Fcallback%2Ftest-provider&state=test-state-123&nonce=test-nonce-456';

            mockClient.authorizationUrl.mockReturnValue(mockAuthUrl);

            const result = await oidcService.initiateAuthFlow('test-provider');

            expect(mockClient.authorizationUrl).toHaveBeenCalledWith({
                scope: 'openid profile email',
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            expect(result.authUrl).toContain('scope=openid%20profile%20email');

            expect(result.authUrl).not.toContain('scope=openid profile email');
        });

        it('should handle scope with plus signs correctly', async () => {
            const mockProvider = {
                slug: 'test-provider',
                name: 'Test Provider',
                issuer: 'https://auth.example.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                scope: 'openid+profile+email',
            };

            providerConfig.getProvider.mockReturnValue(mockProvider);

            stateManager.createState.mockResolvedValue({
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            const mockAuthUrl =
                'https://auth.example.com/authorize?client_id=test-client-id&scope=openid%2Bprofile%2Bemail&response_type=code&redirect_uri=https%3A%2F%2Ftodo.example.com%2Fapi%2Foidc%2Fcallback%2Ftest-provider&state=test-state-123&nonce=test-nonce-456';

            mockClient.authorizationUrl.mockReturnValue(mockAuthUrl);

            const result = await oidcService.initiateAuthFlow('test-provider');

            expect(mockClient.authorizationUrl).toHaveBeenCalledWith({
                scope: 'openid+profile+email',
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            expect(result.authUrl).toBeDefined();
        });

        it('should handle custom scopes with spaces', async () => {
            const mockProvider = {
                slug: 'test-provider',
                name: 'Test Provider',
                issuer: 'https://auth.example.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                scope: 'openid profile email groups offline_access',
            };

            providerConfig.getProvider.mockReturnValue(mockProvider);

            stateManager.createState.mockResolvedValue({
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            const mockAuthUrl =
                'https://auth.example.com/authorize?client_id=test-client-id&scope=openid%20profile%20email%20groups%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Ftodo.example.com%2Fapi%2Foidc%2Fcallback%2Ftest-provider&state=test-state-123&nonce=test-nonce-456';

            mockClient.authorizationUrl.mockReturnValue(mockAuthUrl);

            const result = await oidcService.initiateAuthFlow('test-provider');

            expect(mockClient.authorizationUrl).toHaveBeenCalledWith({
                scope: 'openid profile email groups offline_access',
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            expect(result.authUrl).toContain(
                'scope=openid%20profile%20email%20groups%20offline_access'
            );
        });
    });

    describe('edge cases', () => {
        it('should handle scope with leading/trailing spaces', async () => {
            const mockProvider = {
                slug: 'test-provider',
                name: 'Test Provider',
                issuer: 'https://auth.example.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                scope: '  openid profile email  ',
            };

            providerConfig.getProvider.mockReturnValue(mockProvider);

            stateManager.createState.mockResolvedValue({
                state: 'test-state-123',
                nonce: 'test-nonce-456',
            });

            mockClient.authorizationUrl.mockReturnValue(
                'https://auth.example.com/authorize?scope=openid%20profile%20email'
            );

            const result = await oidcService.initiateAuthFlow('test-provider');

            const scopeArgument =
                mockClient.authorizationUrl.mock.calls[0][0].scope;

            expect(scopeArgument.trim()).toBe('openid profile email');
        });
    });
});
