const signInLinkService = require('../../../modules/members/signInLinkService');
const rolesService = require('../../../services/rolesService');
const { MemberSignInLink, Role } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const { ConflictError } = require('../../../shared/errors');

let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `link-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });

// Sign-in links when two are made at once, when the store fails, for members
// known only by a surname or by nothing, and for a member whose permissions
// go beyond those of whoever created it.
describe('signInLinkService edge cases', () => {
    let creator, member;

    beforeEach(async () => {
        // The first account on an instance becomes its admin, so one is
        // made before the accounts under test.
        const admin = await newUser();
        await Role.update({ is_admin: false }, { where: {} });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        creator = await newUser();
        member = await newUser({
            email: null,
            name: null,
            surname: 'Only',
            created_by_user_id: creator.id,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('turns two links made at once into a conflict', async () => {
        jest.spyOn(MemberSignInLink, 'create').mockRejectedValue(
            Object.assign(new Error('duplicate'), {
                name: 'SequelizeUniqueConstraintError',
            })
        );
        await expect(
            signInLinkService.create(creator.id, member.id)
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('passes any other store failure on', async () => {
        const failure = new Error('disk full');
        jest.spyOn(MemberSignInLink, 'create').mockRejectedValue(failure);
        await expect(
            signInLinkService.create(creator.id, member.id)
        ).rejects.toBe(failure);
    });

    it('names a member by surname, or by nothing', async () => {
        const { url } = await signInLinkService.create(creator.id, member.id);
        const token = new URL(url).searchParams.get('token');
        expect(await signInLinkService.peek(token)).toEqual({ name: 'Only' });

        const nameless = await newUser({
            email: null,
            name: null,
            surname: null,
            created_by_user_id: creator.id,
        });
        const second = await signInLinkService.create(creator.id, nameless.id);
        const secondToken = new URL(second.url).searchParams.get('token');
        expect(await signInLinkService.peek(secondToken)).toEqual({
            name: null,
        });
    });

    it('does not offer a link for a member with more permissions than its creator', async () => {
        await rolesService.setCapabilities(creator.id, {
            create_projects: false,
        });

        const ids = await signInLinkService.issuableAccountIds(creator.id, [
            member.id,
        ]);

        expect(Array.from(ids)).toEqual([]);
    });
});
