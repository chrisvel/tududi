const { Issuer } = require('openid-client');
const oidcService = require('../../../../modules/oidc/service');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const stateManager = require('../../../../modules/oidc/stateManager');

jest.mock('../../../../modules/oidc/providerConfig');
jest.mock('../../../../modules/oidc/stateManager');

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
