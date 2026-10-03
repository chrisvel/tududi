jest.mock('../../../services/logService', () => ({
    ...jest.requireActual('../../../services/logService'),
    logError: jest.fn(),
}));

const accountsService = require('../../../services/accountsService');
const { logError } = require('../../../services/logService');
const rolesService = require('../../../services/rolesService');
const { Account, Role, User, UserGroup } = require('../../../models');
const { getConfig } = require('../../../config/config');
const { createTestUser } = require('../../helpers/testUtils');

const config = getConfig();
let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `accounts-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });

// The account helpers on the paths nothing else takes: self-hosted callers,
// users and creators that no longer exist, an owner who is already an admin,
// and a backfill that meets a failure halfway.
describe('accountsService edge cases', () => {
    afterEach(() => {
        config.hosted.enabled = false;
        jest.restoreAllMocks();
    });

    describe('on a self-hosted instance', () => {
        it('answers as if there were no accounts', async () => {
            const user = await newUser();
            expect(await accountsService.isOwner(user.id)).toBe(false);
            expect(await accountsService.getAccountUserIds(user.id)).toEqual(
                []
            );
            expect(await accountsService.backfill()).toEqual({
                users: 0,
                groups: 0,
            });
            expect(await accountsService.getUserIds(null)).toEqual([]);
        });
    });

    describe('on a hosted instance', () => {
        beforeEach(() => {
            config.hosted.enabled = true;
        });

        it('has no account for a user that does not exist', async () => {
            expect(await accountsService.ensureAccountId(987654)).toBeNull();
            expect(await accountsService.isOwner(null)).toBe(false);
        });

        it('gives a member whose creator is gone an account of its own', async () => {
            config.hosted.enabled = false;
            const member = await newUser({ created_by_user_id: 987654 });
            config.hosted.enabled = true;

            const accountId = await accountsService.ensureAccountId(member.id);

            const account = await Account.findByPk(accountId);
            expect(account.owner_user_id).toBe(member.id);
        });

        it('leaves the role of an owner who is already an admin alone', async () => {
            const owner = await newUser();
            const before = await Role.findOne({ where: { user_id: owner.id } });
            expect(before.role).toBe('account_admin');
            const update = jest.spyOn(Role.prototype, 'update');

            await accountsService.createAccountFor(owner.id);

            expect(update).not.toHaveBeenCalled();
        });

        it('releases an owned account without a transaction', async () => {
            const owner = await newUser();
            await accountsService.releaseOwnedAccount(owner.id);
            expect(
                await Account.count({ where: { owner_user_id: owner.id } })
            ).toBe(0);
            expect((await User.findByPk(owner.id)).account_id).toBeNull();
        });

        it('manages nobody when its account cannot be found', async () => {
            jest.spyOn(rolesService, 'isAccountAdmin').mockResolvedValue(true);
            expect(
                Array.from(await accountsService.managedUserIds(987654))
            ).toEqual([]);
        });

        describe('backfill', () => {
            it('skips a user that disappears while it runs', async () => {
                config.hosted.enabled = false;
                const user = await newUser();
                config.hosted.enabled = true;
                const realFindByPk = User.findByPk.bind(User);
                jest.spyOn(User, 'findByPk').mockImplementation(
                    async (id, options) =>
                        id === user.id ? null : realFindByPk(id, options)
                );

                const result = await accountsService.backfill();

                expect(result.users).toBe(0);
            });

            it('logs a user it cannot place and carries on', async () => {
                config.hosted.enabled = false;
                await newUser();
                config.hosted.enabled = true;
                jest.spyOn(Account, 'findOrCreate').mockRejectedValue(
                    new Error('database busy')
                );
                logError.mockClear();

                const result = await accountsService.backfill();

                expect(result.users).toBe(0);
                expect(logError).toHaveBeenCalled();
            });

            it('leaves a group whose creator is gone without an account', async () => {
                config.hosted.enabled = false;
                const creator = await newUser();
                const group = await UserGroup.create({
                    name: `Orphan ${counter}`,
                    created_by_user_id: creator.id,
                });
                config.hosted.enabled = true;
                // The users table would null the creator on delete, so the
                // creator is made to vanish only for the lookup.
                const realFindByPk = User.findByPk.bind(User);
                jest.spyOn(User, 'findByPk').mockImplementation(
                    async (id, options) =>
                        id === creator.id ? null : realFindByPk(id, options)
                );

                const result = await accountsService.backfill();

                expect(result.groups).toBe(0);
                expect((await group.reload()).account_id).toBeNull();
            });

            it('logs a group it cannot place and carries on', async () => {
                config.hosted.enabled = false;
                const creator = await newUser();
                const group = await UserGroup.create({
                    name: `Failing ${counter}`,
                    created_by_user_id: creator.id,
                });
                config.hosted.enabled = true;
                await accountsService.ensureAccountId(creator.id);
                jest.spyOn(UserGroup.prototype, 'update').mockRejectedValue(
                    new Error('database busy')
                );
                logError.mockClear();

                const result = await accountsService.backfill();

                expect(result.groups).toBe(0);
                expect(logError).toHaveBeenCalled();
                expect(
                    (await UserGroup.findByPk(group.id)).account_id
                ).toBeNull();
            });
        });
    });
});
