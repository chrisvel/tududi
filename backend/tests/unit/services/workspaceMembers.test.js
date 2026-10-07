const { getWorkspaceUserIds } = require('../../../services/workspaceMembers');
const {
    User,
    UserGroup,
    UserGroupMember,
    Permission,
    sequelize,
} = require('../../../models');

let counter = 0;
const makeUser = (over = {}) => {
    counter += 1;
    return User.create({
        email: `user${counter}@example.com`,
        name: `User ${counter}`,
        ...over,
    });
};

describe('getWorkspaceUserIds', () => {
    afterAll(async () => {
        await sequelize.close();
    });

    it('is empty for someone who works with nobody', async () => {
        const me = await makeUser();
        await makeUser();

        expect(await getWorkspaceUserIds(me.id)).toEqual([]);
    });

    it('includes the accounts a user created', async () => {
        const me = await makeUser();
        const kid = await makeUser({ email: null, created_by_user_id: me.id });
        const other = await makeUser();

        const ids = await getWorkspaceUserIds(me.id);

        expect(ids).toContain(kid.id);
        expect(ids).not.toContain(other.id);
    });

    it('includes the account that created a user', async () => {
        const parent = await makeUser();
        const kid = await makeUser({
            email: null,
            created_by_user_id: parent.id,
        });

        expect(await getWorkspaceUserIds(kid.id)).toEqual([parent.id]);
    });

    it('does not connect two accounts that only share a creator', async () => {
        const parent = await makeUser();
        const first = await makeUser({ created_by_user_id: parent.id });
        const second = await makeUser({ created_by_user_id: parent.id });

        expect(await getWorkspaceUserIds(first.id)).not.toContain(second.id);
    });

    it('still includes group co-members and share partners', async () => {
        const me = await makeUser();
        const mate = await makeUser();
        const partner = await makeUser();
        const group = await UserGroup.create({ name: 'Family' });
        await UserGroupMember.bulkCreate([
            { group_id: group.id, user_id: me.id },
            { group_id: group.id, user_id: mate.id },
        ]);
        await Permission.create({
            user_id: partner.id,
            resource_type: 'project',
            resource_uid: 'abc123abc123abc',
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: me.id,
            status: 'accepted',
        });

        const ids = await getWorkspaceUserIds(me.id);

        expect(ids.sort()).toEqual([mate.id, partner.id].sort());
    });

    it('lists an account once however it is connected', async () => {
        const me = await makeUser();
        const kid = await makeUser({ email: null, created_by_user_id: me.id });
        const group = await UserGroup.create({ name: 'Family' });
        await UserGroupMember.bulkCreate([
            { group_id: group.id, user_id: me.id },
            { group_id: group.id, user_id: kid.id },
        ]);

        expect(await getWorkspaceUserIds(me.id)).toEqual([kid.id]);
    });

    it('never includes the user themselves', async () => {
        const me = await makeUser();
        await makeUser({ created_by_user_id: me.id });

        expect(await getWorkspaceUserIds(me.id)).not.toContain(me.id);
    });
});
