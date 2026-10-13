const identityService = require('../../../../modules/oidc/oidcIdentityService');
const { OIDCIdentity } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');

let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `identity-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });
const newIdentity = (userId, extra = {}) =>
    OIDCIdentity.create({
        user_id: userId,
        provider_slug: 'google',
        subject: `sub-${Date.now()}-${++counter}`,
        email: 'old@example.com',
        name: 'Old Name',
        ...extra,
    });

// Unlinking and refreshing single sign-on identities: an identity that is not
// the caller's, the last way into an account, and claims that only partly
// change.
describe('oidcIdentityService edge cases', () => {
    it("refuses to unlink an identity that is not the caller's", async () => {
        const owner = await newUser();
        const other = await newUser();
        const identity = await newIdentity(owner.id);

        await expect(
            identityService.unlinkIdentity(identity.id, other.id)
        ).rejects.toThrow('Identity not found or does not belong to this user');
        expect(await OIDCIdentity.findByPk(identity.id)).not.toBeNull();
    });

    it('refuses to unlink the last way into an account without a password', async () => {
        const user = await newUser({ password_digest: null });
        const identity = await newIdentity(user.id);

        await expect(
            identityService.unlinkIdentity(identity.id, user.id)
        ).rejects.toThrow(/Cannot unlink the last authentication method/);
        expect(await identityService.canUnlink(identity.id, user.id)).toEqual({
            canUnlink: false,
            reason: 'This is your only authentication method',
        });
    });

    it('unlinks one of two identities of an account without a password', async () => {
        const user = await newUser({ password_digest: null });
        const first = await newIdentity(user.id);
        await newIdentity(user.id, { provider_slug: 'github' });

        expect(await identityService.unlinkIdentity(first.id, user.id)).toBe(
            true
        );
        expect(await OIDCIdentity.findByPk(first.id)).toBeNull();
    });

    describe('updateIdentityClaims', () => {
        it('refuses an identity that does not exist', async () => {
            await expect(
                identityService.updateIdentityClaims(987654, {})
            ).rejects.toThrow('Identity not found');
        });

        it('keeps what the new claims leave out', async () => {
            const user = await newUser();
            const identity = await newIdentity(user.id, {
                given_name: 'Old',
                family_name: 'Name',
                picture: 'old.png',
            });

            const kept = await identityService.updateIdentityClaims(
                identity.id,
                {}
            );
            expect(kept.email).toBe('old@example.com');
            expect(kept.name).toBe('Old Name');
            expect(kept.picture).toBe('old.png');

            const changed = await identityService.updateIdentityClaims(
                identity.id,
                {
                    email: 'new@example.com',
                    name: 'New Name',
                    given_name: 'New',
                    family_name: 'Person',
                    picture: 'new.png',
                }
            );
            expect(changed.email).toBe('new@example.com');
            expect(changed.given_name).toBe('New');
            expect(changed.family_name).toBe('Person');
            expect(changed.picture).toBe('new.png');
        });
    });
});
