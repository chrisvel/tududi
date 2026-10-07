jest.mock('../../../modules/shares/repository', () => ({
    findResourceOwner: jest.fn(),
    findResourceSummary: jest.fn(),
    findCandidateUsers: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    findDirectPermission: jest.fn(),
    findPermissions: jest.fn(),
    findUsersByIds: jest.fn(),
    findPendingInvitations: jest.fn(),
    findPendingGroupInvitations: jest.fn(),
}));
jest.mock('../../../modules/groups/repository', () => ({
    findByUid: jest.fn(),
}));
jest.mock('../../../services/execAction', () => ({ execAction: jest.fn() }));
jest.mock('../../../services/groupSharing', () => ({
    grantToGroup: jest.fn(),
    revokeFromGroup: jest.fn(),
    listForResource: jest.fn(async () => []),
}));
jest.mock('../../../services/rolesService', () => ({
    ...jest.requireActual('../../../services/rolesService'),
    isAdmin: jest.fn(),
}));
jest.mock('../../../services/workspaceMembers', () => ({
    getWorkspaceUserIds: jest.fn(),
}));
jest.mock('../../../services/logService', () => ({
    ...jest.requireActual('../../../services/logService'),
    logError: jest.fn(),
}));

const sharesService = require('../../../modules/shares/service');
const repo = require('../../../modules/shares/repository');
const groupsRepository = require('../../../modules/groups/repository');
const { execAction } = require('../../../services/execAction');
const groupSharing = require('../../../services/groupSharing');
const { getWorkspaceUserIds } = require('../../../services/workspaceMembers');
const { logError } = require('../../../services/logService');
const { Notification } = require('../../../models');
const { NotFoundError, ValidationError } = require('../../../shared/errors');

const OWNER = 1;
const share = (extra) => ({
    resource_type: 'project',
    resource_uid: 'p1',
    access_level: 'ro',
    ...extra,
});

// Sharing on the paths the integration tests leave out: unsupported or
// missing resources, sharing with or revoking from the owner, invitations
// whose inviter, resource or notification is missing, and the share list of
// a resource whose owner is gone.
describe('sharesService edge cases', () => {
    beforeEach(() => {
        repo.findResourceOwner.mockResolvedValue({ user_id: OWNER });
        repo.findResourceSummary.mockResolvedValue({
            uid: 'p1',
            name: 'Garden',
            user_id: OWNER,
        });
        groupSharing.listForResource.mockResolvedValue([]);
        repo.findPendingInvitations.mockResolvedValue([]);
        repo.findPendingGroupInvitations.mockResolvedValue([]);
        jest.spyOn(Notification, 'createNotification').mockResolvedValue({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('listCandidates', () => {
        it('labels members by name, email or as "Member", sorted', async () => {
            getWorkspaceUserIds.mockResolvedValue([2, 3, 4]);
            repo.findCandidateUsers.mockResolvedValue([
                { id: 2, uid: 'b', name: 'Zoe', surname: null, email: null },
                {
                    id: 3,
                    uid: 'c',
                    name: null,
                    surname: null,
                    email: 'anna@example.com',
                },
                { id: 4, uid: 'd', name: null, surname: null, email: null },
            ]);

            const list = await sharesService.listCandidates(OWNER);

            expect(list.map((c) => c.name)).toEqual(['anna', 'Member', 'Zoe']);
        });
    });

    describe('createShare', () => {
        it('refuses a type that cannot be shared', async () => {
            await expect(
                sharesService.createShare(
                    OWNER,
                    share({ resource_type: 'tag', target_user_id: 2 })
                )
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('refuses a resource that is gone', async () => {
            repo.findResourceSummary.mockResolvedValue(null);
            await expect(
                sharesService.createShare(OWNER, share({ target_user_id: 2 }))
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it('refuses a group that does not exist', async () => {
            groupsRepository.findByUid.mockResolvedValue(null);
            await expect(
                sharesService.createShare(
                    OWNER,
                    share({ target_group_uid: 'nope' })
                )
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it('refuses to share with the owner', async () => {
            repo.findUserByEmail.mockResolvedValue({ id: OWNER });
            await expect(
                sharesService.createShare(
                    OWNER,
                    share({ target_user_email: 'owner@example.com' })
                )
            ).rejects.toBeInstanceOf(ValidationError);
            expect(execAction).not.toHaveBeenCalled();
        });

        it('says the same thing for an email without an account', async () => {
            repo.findUserByEmail.mockResolvedValue(null);
            expect(
                await sharesService.createShare(
                    OWNER,
                    share({ target_user_email: 'nobody@example.com' })
                )
            ).toBeNull();
            expect(execAction).not.toHaveBeenCalled();
        });
    });

    describe('notifyInvitee', () => {
        const target = { id: 2 };

        it('names an inviter and a resource it cannot find', async () => {
            repo.findUserById.mockResolvedValue(null);
            repo.findDirectPermission.mockResolvedValue(null);

            await sharesService.notifyInvitee({
                actorUserId: OWNER,
                target,
                resource: { uid: 'p1', name: null },
                resourceType: 'project',
                accessLevel: 'rw',
                actionId: 9,
            });

            const [call] = Notification.createNotification.mock.calls;
            expect(call[0].title).toBe('Someone invited you to a project');
            expect(call[0].message).toMatch(/^"project" was shared/);
            expect(call[0].data.invitationId).toBeNull();
            expect(call[0].data.inviterEmail).toBeNull();
        });

        it('falls back to the email of an inviter without a name', async () => {
            repo.findUserById.mockResolvedValue({ email: 'me@example.com' });
            repo.findDirectPermission.mockResolvedValue({ id: 5 });

            await sharesService.notifyInvitee({
                actorUserId: OWNER,
                target,
                resource: { uid: 'p1', name: 'Garden' },
                resourceType: 'project',
                accessLevel: 'ro',
                actionId: 9,
            });

            const [call] = Notification.createNotification.mock.calls;
            expect(call[0].title).toBe(
                'me@example.com invited you to a project'
            );
        });

        it('keeps the share when the notification fails', async () => {
            repo.findUserById.mockResolvedValue({ name: 'Me' });
            Notification.createNotification.mockRejectedValue(
                new Error('queue down')
            );

            await sharesService.notifyInvitee({
                actorUserId: OWNER,
                target,
                resource: { uid: 'p1', name: 'Garden' },
                resourceType: 'project',
                accessLevel: 'ro',
                actionId: 9,
            });

            expect(logError).toHaveBeenCalled();
        });
    });

    describe('deleteShare', () => {
        it.each([
            [{ resource_type: 'project', resource_uid: 'p1' }],
            [{ resource_uid: 'p1', target_user_id: 2 }],
        ])('needs a resource and a target: %p', async (data) => {
            await expect(
                sharesService.deleteShare(OWNER, data)
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('refuses a user and a group at once', async () => {
            await expect(
                sharesService.deleteShare(
                    OWNER,
                    share({ target_user_id: 2, target_group_uid: 'g' })
                )
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('refuses a group that does not exist', async () => {
            groupsRepository.findByUid.mockResolvedValue(null);
            await expect(
                sharesService.deleteShare(
                    OWNER,
                    share({ target_group_uid: 'nope' })
                )
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it('refuses to revoke the owner', async () => {
            await expect(
                sharesService.deleteShare(
                    OWNER,
                    share({ target_user_id: String(OWNER) })
                )
            ).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe('getShares', () => {
        it('needs a resource', async () => {
            await expect(
                sharesService.getShares(OWNER, 'project', '')
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('lists shares without an owner row when the owner is gone', async () => {
            repo.findResourceOwner
                .mockResolvedValueOnce({ user_id: OWNER })
                .mockResolvedValueOnce({ user_id: OWNER });
            repo.findUserById.mockResolvedValue(null);
            repo.findPermissions.mockResolvedValue([
                { user_id: 2, access_level: 'ro' },
                { user_id: 3, access_level: 'rw' },
            ]);
            repo.findUsersByIds.mockResolvedValue([
                { id: 2, email: 'two@example.com', avatar_image: null },
            ]);

            const { shares } = await sharesService.getShares(
                OWNER,
                'project',
                'p1'
            );

            expect(shares).toEqual([
                expect.objectContaining({
                    user_id: 2,
                    email: 'two@example.com',
                    avatar_image: null,
                }),
                expect.objectContaining({
                    user_id: 3,
                    email: null,
                    avatar_image: null,
                }),
            ]);
        });

        it('lists no owner row for a resource that is gone', async () => {
            repo.findResourceOwner
                .mockResolvedValueOnce({ user_id: OWNER })
                .mockResolvedValueOnce(null);
            repo.findPermissions.mockResolvedValue([]);

            const { shares } = await sharesService.getShares(
                OWNER,
                'project',
                'p1'
            );

            expect(shares).toEqual([]);
        });
    });

    describe('listInvitations', () => {
        it('skips invitations to resources that are gone and copes with missing inviters', async () => {
            repo.findPendingGroupInvitations.mockResolvedValue([
                {
                    id: 1,
                    resource_type: 'project',
                    resource_uid: 'gone',
                    granted_by_user_id: 5,
                },
                {
                    id: 2,
                    resource_type: 'project',
                    resource_uid: 'p1',
                    access_level: 'ro',
                    created_at: '2026-10-01',
                    granted_by_user_id: 5,
                    GroupShare: { Group: { uid: 'g', name: 'Kids' } },
                },
            ]);
            repo.findPendingInvitations.mockResolvedValue([
                {
                    id: 3,
                    resource_type: 'project',
                    resource_uid: 'gone',
                    granted_by_user_id: 5,
                },
                {
                    id: 4,
                    resource_type: 'project',
                    resource_uid: 'p1',
                    access_level: 'rw',
                    created_at: '2026-10-02',
                    granted_by_user_id: 5,
                },
            ]);
            repo.findResourceSummary.mockImplementation(async (type, uid) =>
                uid === 'gone' ? null : { uid, name: 'Garden' }
            );
            repo.findUserById.mockResolvedValue(null);

            const { invitations } = await sharesService.listInvitations(2);

            expect(invitations.map((i) => i.id)).toEqual([4, 'g2']);
            expect(invitations.every((i) => i.inviter_email === null)).toBe(
                true
            );
            expect(invitations.every((i) => i.inviter_name === null)).toBe(
                true
            );
        });
    });
});
