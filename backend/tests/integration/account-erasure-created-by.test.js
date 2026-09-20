const { User, sequelize } = require('../../models');
const { eraseUserAccount } = require('../../services/accountErasureService');
const { getWorkspaceUserIds } = require('../../services/workspaceMembers');
const { createTestUser } = require('../helpers/testUtils');

describe('erasing the account that created another', () => {
    // The first account is the admin, and the last admin cannot be erased.
    beforeEach(async () => {
        await createTestUser({ email: 'root@example.com' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('keeps the created account and forgets who created it', async () => {
        const creator = await createTestUser({ email: 'creator@example.com' });
        const kid = await User.create({
            name: 'Kid',
            created_by_user_id: creator.id,
        });

        await eraseUserAccount(creator.id);

        const after = await User.findByPk(kid.id);
        expect(after).toBeTruthy();
        expect(after.created_by_user_id).toBeNull();
    });

    it('drops the connection between the two', async () => {
        const creator = await createTestUser({ email: 'creator@example.com' });
        const kid = await User.create({
            name: 'Kid',
            created_by_user_id: creator.id,
        });
        expect(await getWorkspaceUserIds(kid.id)).toEqual([creator.id]);

        await eraseUserAccount(creator.id);

        expect(await getWorkspaceUserIds(kid.id)).toEqual([]);
    });

    it('leaves accounts created by someone else alone', async () => {
        const creator = await createTestUser({ email: 'creator@example.com' });
        const other = await createTestUser({ email: 'other@example.com' });
        const kid = await User.create({
            name: 'Kid',
            created_by_user_id: other.id,
        });

        await eraseUserAccount(creator.id);

        expect((await User.findByPk(kid.id)).created_by_user_id).toBe(other.id);
    });
});
