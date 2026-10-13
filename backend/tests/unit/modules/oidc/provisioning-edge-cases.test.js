jest.mock('../../../../modules/oidc/providerConfig', () => ({
    ...jest.requireActual('../../../../modules/oidc/providerConfig'),
    getProvider: jest.fn(),
}));
jest.mock('../../../../services/logService', () => ({
    ...jest.requireActual('../../../../services/logService'),
    logError: jest.fn(),
}));

const provisioning = require('../../../../modules/oidc/provisioningService');
const providerConfig = require('../../../../modules/oidc/providerConfig');
const peopleService = require('../../../../modules/people/service');
const { logError } = require('../../../../services/logService');
const { OIDCIdentity, User } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');
const { OidcUserError } = require('../../../../modules/oidc/errors');

let counter = 0;
const stamp = () => `${Date.now()}-${++counter}`;
const claimsFor = (extra = {}) => {
    const id = stamp();
    return {
        sub: `sub-${id}`,
        email: `sso-edge-${id}@example.com`,
        email_verified: true,
        name: 'Single Sign',
        ...extra,
    };
};

// Signing up and linking with single sign-on when something is missing or
// fails: no provider, no account, an identity already linked to the same
// account, and failures after the transaction opened.
describe('OIDC provisioning edge cases', () => {
    beforeEach(() => {
        providerConfig.getProvider.mockResolvedValue({
            slug: 'google',
            autoProvision: true,
            adminEmailDomains: [],
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('helpers', () => {
        it('never makes an admin of a claim without an email', () => {
            expect(
                provisioning.shouldBeAdmin(
                    { adminEmailDomains: ['example.com'] },
                    undefined
                )
            ).toBe(false);
        });

        it('takes the family name as the name when it is all there is', () => {
            expect(
                provisioning.nameFromClaims({ family_name: 'Smith' })
            ).toEqual({ name: 'Smith', surname: null });
        });

        it('finds an identity by provider and subject', async () => {
            const user = await createTestUser({
                email: `${stamp()}@example.com`,
            });
            await OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'google',
                subject: 'known-sub',
            });

            const found = await provisioning.findOrCreateIdentity('google', {
                sub: 'known-sub',
            });
            const missing = await provisioning.findOrCreateIdentity('google', {
                sub: 'unknown-sub',
            });

            expect(found.User.id).toBe(user.id);
            expect(missing).toBeNull();
        });
    });

    describe('provisionUser', () => {
        it('refuses a provider that is not configured', async () => {
            providerConfig.getProvider.mockResolvedValue(null);
            await expect(
                provisioning.provisionUser('missing', claimsFor(), {})
            ).rejects.toThrow('Provider not found: missing');
        });

        it('keeps a new account when its self-person cannot be made', async () => {
            jest.spyOn(peopleService, 'createSelfPerson').mockRejectedValue(
                new Error('people locked')
            );

            const { user, isNewUser } = await provisioning.provisionUser(
                'google',
                claimsFor(),
                {}
            );

            expect(isNewUser).toBe(true);
            expect(await User.findByPk(user.id)).not.toBeNull();
            expect(logError).toHaveBeenCalled();
        });

        it('rolls back when the identity cannot be saved', async () => {
            const claims = claimsFor();
            jest.spyOn(OIDCIdentity, 'create').mockRejectedValue(
                new Error('disk full')
            );

            await expect(
                provisioning.provisionUser('google', claims, {})
            ).rejects.toThrow('disk full');
            expect(await User.count({ where: { email: claims.email } })).toBe(
                0
            );
        });
    });

    describe('linkIdentityToUser', () => {
        let user;

        beforeEach(async () => {
            user = await createTestUser({
                email: `link-${stamp()}@example.com`,
            });
        });

        it('refuses a provider that is not configured', async () => {
            providerConfig.getProvider.mockResolvedValue(null);
            await expect(
                provisioning.linkIdentityToUser(user.id, 'missing', claimsFor())
            ).rejects.toThrow('Provider not found: missing');
        });

        it('returns the identity when it is already linked to the same account', async () => {
            const claims = claimsFor();
            const first = await provisioning.linkIdentityToUser(
                user.id,
                'google',
                claims
            );
            const again = await provisioning.linkIdentityToUser(
                user.id,
                'google',
                claims
            );
            expect(again.id).toBe(first.id);
        });

        it('refuses an identity linked to another account', async () => {
            const claims = claimsFor();
            const other = await createTestUser({
                email: `other-${stamp()}@example.com`,
            });
            await provisioning.linkIdentityToUser(other.id, 'google', claims);

            await expect(
                provisioning.linkIdentityToUser(user.id, 'google', claims)
            ).rejects.toBeInstanceOf(OidcUserError);
        });

        it('refuses an account that does not exist', async () => {
            await expect(
                provisioning.linkIdentityToUser(987654, 'google', claimsFor())
            ).rejects.toThrow('User not found');
        });

        it('rolls back when the identity cannot be saved', async () => {
            jest.spyOn(OIDCIdentity, 'create').mockRejectedValue(
                new Error('disk full')
            );
            await expect(
                provisioning.linkIdentityToUser(user.id, 'google', claimsFor())
            ).rejects.toThrow('disk full');
            expect(
                await OIDCIdentity.count({ where: { user_id: user.id } })
            ).toBe(0);
        });
    });
});
