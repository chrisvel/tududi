const { sequelize, User, OIDCIdentity, Role } = require('../../../../models');
const provisioningService = require('../../../../modules/oidc/provisioningService');
const providerConfig = require('../../../../modules/oidc/providerConfig');

jest.mock('../../../../modules/oidc/providerConfig');

describe('OIDC Provisioning Service', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        await OIDCIdentity.destroy({ where: {}, force: true });
        await Role.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });

        providerConfig.getProvider.mockReturnValue({
            slug: 'test-provider',
            name: 'Test Provider',
            autoProvision: true,
            adminEmailDomains: ['admin.com'],
        });
    });

    describe('provisionUser', () => {
        it('should return user object when existing identity logs in', async () => {
            const existingUser = await User.create({
                email: 'test@example.com',
                username: 'testuser',
                password_digest: 'hashed',
                verified_email: true,
            });

            await OIDCIdentity.create({
                user_id: existingUser.id,
                provider_slug: 'test-provider',
                subject: 'sub-123',
                email: 'test@example.com',
                name: 'Test User',
                first_login_at: new Date(),
                last_login_at: new Date(),
            });

            const claims = {
                sub: 'sub-123',
                email: 'test@example.com',
                name: 'Test User Updated',
            };

            const result = await provisioningService.provisionUser(
                'test-provider',
                claims,
                {}
            );

            expect(result).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.id).toBe(existingUser.id);
            expect(result.user.email).toBe('test@example.com');
            expect(result.isNewUser).toBe(false);
        });

        it('should create new user when auto-provision is enabled and identity does not exist', async () => {
            const claims = {
                sub: 'sub-456',
                email: 'newuser@example.com',
                name: 'New User',
                given_name: 'New',
                family_name: 'User',
            };

            const result = await provisioningService.provisionUser(
                'test-provider',
                claims,
                {}
            );

            expect(result).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe('newuser@example.com');
            expect(result.isNewUser).toBe(true);

            const identity = await OIDCIdentity.findOne({
                where: { subject: 'sub-456' },
            });
            expect(identity).toBeDefined();
            expect(identity.user_id).toBe(result.user.id);
        });

        it('should link existing user by email when creating new identity', async () => {
            const existingUser = await User.create({
                email: 'existing@example.com',
                username: 'existing',
                password_digest: 'hashed',
                verified_email: true,
            });

            const claims = {
                sub: 'sub-789',
                email: 'existing@example.com',
                name: 'Existing User',
            };

            const result = await provisioningService.provisionUser(
                'test-provider',
                claims,
                {}
            );

            expect(result).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.id).toBe(existingUser.id);
            expect(result.isNewUser).toBe(false);

            const identity = await OIDCIdentity.findOne({
                where: { subject: 'sub-789' },
            });
            expect(identity).toBeDefined();
            expect(identity.user_id).toBe(existingUser.id);
        });

        it('should throw error when auto-provision is disabled and user does not exist', async () => {
            providerConfig.getProvider.mockReturnValue({
                slug: 'test-provider',
                name: 'Test Provider',
                autoProvision: false,
            });

            const claims = {
                sub: 'sub-999',
                email: 'notallowed@example.com',
                name: 'Not Allowed',
            };

            await expect(
                provisioningService.provisionUser('test-provider', claims, {})
            ).rejects.toThrow('Auto-provisioning is disabled');
        });

        it('should throw error when email claim is missing', async () => {
            const claims = {
                sub: 'sub-000',
                name: 'No Email User',
            };

            await expect(
                provisioningService.provisionUser('test-provider', claims, {})
            ).rejects.toThrow('Email claim is required');
        });

        it('should set admin flag when email domain matches admin domains', async () => {
            const claims = {
                sub: 'sub-admin',
                email: 'admin@admin.com',
                name: 'Admin User',
            };

            const result = await provisioningService.provisionUser(
                'test-provider',
                claims,
                {}
            );

            const role = await Role.findOne({
                where: { user_id: result.user.id },
            });
            expect(role).toBeDefined();
            expect(role.is_admin).toBe(true);
        });
    });

    describe('linkIdentityToUser', () => {
        it('should link new identity to existing user', async () => {
            const user = await User.create({
                email: 'link@example.com',
                username: 'linkuser',
                password_digest: 'hashed',
                verified_email: true,
            });

            const claims = {
                sub: 'sub-link-123',
                email: 'link@example.com',
                name: 'Link User',
            };

            const identity = await provisioningService.linkIdentityToUser(
                user.id,
                'test-provider',
                claims
            );

            expect(identity).toBeDefined();
            expect(identity.user_id).toBe(user.id);
            expect(identity.subject).toBe('sub-link-123');
        });

        it('should throw error when identity is already linked to another user', async () => {
            const user1 = await User.create({
                email: 'user1@example.com',
                username: 'user1',
                password_digest: 'hashed',
                verified_email: true,
            });

            const user2 = await User.create({
                email: 'user2@example.com',
                username: 'user2',
                password_digest: 'hashed',
                verified_email: true,
            });

            await OIDCIdentity.create({
                user_id: user1.id,
                provider_slug: 'test-provider',
                subject: 'sub-existing',
                email: 'user1@example.com',
                name: 'User 1',
                first_login_at: new Date(),
                last_login_at: new Date(),
            });

            const claims = {
                sub: 'sub-existing',
                email: 'user2@example.com',
                name: 'User 2',
            };

            await expect(
                provisioningService.linkIdentityToUser(
                    user2.id,
                    'test-provider',
                    claims
                )
            ).rejects.toThrow('already linked to another user');
        });
    });

    describe('shouldBeAdmin', () => {
        it('should return true when email domain matches admin domains', () => {
            const config = { adminEmailDomains: ['admin.com', 'company.com'] };
            expect(
                provisioningService.shouldBeAdmin(config, 'user@admin.com')
            ).toBe(true);
            expect(
                provisioningService.shouldBeAdmin(config, 'user@company.com')
            ).toBe(true);
        });

        it('should return false when email domain does not match', () => {
            const config = { adminEmailDomains: ['admin.com'] };
            expect(
                provisioningService.shouldBeAdmin(config, 'user@other.com')
            ).toBe(false);
        });

        it('should return false when adminEmailDomains is empty', () => {
            const config = { adminEmailDomains: [] };
            expect(
                provisioningService.shouldBeAdmin(config, 'user@admin.com')
            ).toBe(false);
        });

        it('should return false when adminEmailDomains is not set', () => {
            const config = {};
            expect(
                provisioningService.shouldBeAdmin(config, 'user@admin.com')
            ).toBe(false);
        });
    });
});
