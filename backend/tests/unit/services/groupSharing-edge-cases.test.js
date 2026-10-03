jest.mock('../../../services/logService', () => ({
    ...jest.requireActual('../../../services/logService'),
    logError: jest.fn(),
}));
jest.mock('../../../services/permissionsCalculators', () => {
    const actual = jest.requireActual(
        '../../../services/permissionsCalculators'
    );
    return {
        ...actual,
        projectSubtreeChanges: jest.fn(actual.projectSubtreeChanges),
    };
});

const groupSharing = require('../../../services/groupSharing');
const calculators = require('../../../services/permissionsCalculators');
const { logError } = require('../../../services/logService');
const {
    GroupPermission,
    GroupShare,
    Notification,
    Project,
    UserGroup,
    UserGroupMember,
} = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `group-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });

const newGroup = async (memberIds) => {
    const group = await UserGroup.create({ name: `Edge ${++counter}` });
    for (const userId of memberIds) {
        await UserGroupMember.create({ group_id: group.id, user_id: userId });
    }
    return group;
};

const notificationsFor = (userId) =>
    Notification.findAll({ where: { user_id: userId }, raw: true });

// Group sharing when something is missing or odd: an inviter without a name
// or email, a resource that is gone, notifications that fail, levels it does
// not rank, and container grants copied onto a project.
describe('groupSharing edge cases', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        logError.mockClear();
    });

    describe('invitations', () => {
        it('names an inviter without a name or email "Someone"', async () => {
            const owner = await newUser({ email: null, name: null });
            const member = await newUser();
            const project = await Project.create({
                name: 'Garden',
                user_id: owner.id,
            });
            const group = await newGroup([member.id]);

            await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'ro',
                ownerUserId: owner.id,
            });

            const [invite] = await notificationsFor(member.id);
            expect(invite.title).toMatch(/^Someone shared a project/);
            const data =
                typeof invite.data === 'string'
                    ? JSON.parse(invite.data)
                    : invite.data;
            expect(data.inviterEmail).toBeNull();
        });

        it('names a resource it cannot find by its type', async () => {
            const owner = await newUser({ name: 'Owner' });
            const member = await newUser();
            const project = await Project.create({
                name: 'Garden',
                user_id: owner.id,
            });
            const group = await newGroup([member.id]);
            const realFindOne = Project.findOne.bind(Project);
            jest.spyOn(Project, 'findOne').mockImplementation(
                async (options) =>
                    options?.attributes?.length === 1 &&
                    options.attributes[0] === 'name'
                        ? null
                        : realFindOne(options)
            );

            await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'rw',
                ownerUserId: owner.id,
            });

            const [invite] = await notificationsFor(member.id);
            expect(invite.message).toMatch(/^"project" was shared/);
        });

        it('keeps the grant when notifications fail', async () => {
            const owner = await newUser({ name: 'Owner' });
            const member = await newUser();
            const project = await Project.create({
                name: 'Garden',
                user_id: owner.id,
            });
            const group = await newGroup([member.id]);
            jest.spyOn(Notification, 'createNotification').mockRejectedValue(
                new Error('mail queue down')
            );

            const share = await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'ro',
                ownerUserId: owner.id,
            });

            expect(share.id).toBeDefined();
            expect(
                await GroupPermission.count({
                    where: { user_id: member.id, group_share_id: share.id },
                })
            ).toBeGreaterThan(0);
            expect(logError).toHaveBeenCalled();
        });
    });

    describe('levels it does not rank', () => {
        it('treats them as below read-only and invites nobody up front', async () => {
            const owner = await newUser({ name: 'Owner' });
            const member = await newUser();
            const project = await Project.create({
                name: 'Garden',
                user_id: owner.id,
            });
            const group = await newGroup([member.id]);
            const first = await GroupShare.create({
                group_id: group.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'legacy',
                granted_by_user_id: owner.id,
            });

            const share = await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'ro',
                ownerUserId: owner.id,
            });
            expect(share.id).toBe(first.id);
            expect(share.access_level).toBe('ro');

            const kept = await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'mystery',
                ownerUserId: owner.id,
            });
            expect(kept.access_level).toBe('ro');

            const otherProject = await Project.create({
                name: 'Shed',
                user_id: owner.id,
            });
            const odd = await groupSharing.grantToGroup({
                actorUserId: owner.id,
                group,
                resourceType: 'project',
                resourceUid: otherProject.uid,
                accessLevel: 'mystery',
                ownerUserId: owner.id,
            });
            const rows = await GroupPermission.findAll({
                where: { group_share_id: odd.id, user_id: member.id },
            });
            expect(rows.every((r) => r.status === 'accepted')).toBe(true);
        });
    });

    describe('adding members', () => {
        it('skips shares whose resource is gone', async () => {
            const owner = await newUser();
            const member = await newUser();
            const group = await newGroup([]);
            const gone = await GroupShare.create({
                group_id: group.id,
                resource_type: 'project',
                resource_uid: 'gone-project',
                access_level: 'ro',
                granted_by_user_id: owner.id,
            });

            await groupSharing.addMembers({
                group,
                userIds: [member.id],
                addedByUserId: owner.id,
            });

            expect(
                await UserGroupMember.count({
                    where: { group_id: group.id, user_id: member.id },
                })
            ).toBe(1);
            expect(
                await GroupPermission.count({
                    where: { group_share_id: gone.id },
                })
            ).toBe(0);
        });
    });

    describe('mirrorContainerGrants', () => {
        it('skips the project owner and builds one template per level', async () => {
            const owner = await newUser();
            const a = await newUser();
            const b = await newUser();
            const project = await Project.create({
                name: 'Moved in',
                user_id: owner.id,
            });
            jest.spyOn(GroupPermission, 'findAll').mockImplementation(
                async ({ where }) =>
                    where.propagation === 'direct'
                        ? [
                              {
                                  user_id: owner.id,
                                  access_level: 'ro',
                                  group_share_id: 1,
                                  granted_by_user_id: owner.id,
                                  status: 'accepted',
                              },
                              {
                                  user_id: a.id,
                                  access_level: 'ro',
                                  group_share_id: 1,
                                  granted_by_user_id: owner.id,
                                  status: 'accepted',
                              },
                              {
                                  user_id: b.id,
                                  access_level: 'ro',
                                  group_share_id: 1,
                                  granted_by_user_id: owner.id,
                                  status: 'pending',
                              },
                          ]
                        : []
            );
            const bulkCreate = jest
                .spyOn(GroupPermission, 'bulkCreate')
                .mockResolvedValue([]);
            calculators.projectSubtreeChanges.mockClear();
            calculators.projectSubtreeChanges.mockImplementationOnce(
                async (changes, proj, action) => {
                    // A row without a propagation is written as direct.
                    changes.upserts.push({
                        resourceType: 'project',
                        resourceUid: proj.uid,
                        accessLevel: action.accessLevel,
                    });
                }
            );

            await groupSharing.mirrorContainerGrants(null, project, [
                { type: 'area', uid: 'area-1' },
            ]);

            expect(calculators.projectSubtreeChanges).toHaveBeenCalledTimes(1);
            const written = bulkCreate.mock.calls.flatMap(([rows]) => rows);
            expect(written.map((r) => r.user_id).sort()).toEqual(
                [a.id, b.id].sort()
            );
            expect(written.every((r) => r.propagation === 'direct')).toBe(true);
        });
    });
});
