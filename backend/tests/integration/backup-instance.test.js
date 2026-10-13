const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');
const app = require('../../app');
const {
    Project,
    Task,
    Person,
    Permission,
    Role,
    User,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { getConfig } = require('../../config/config');
const {
    exportUserData,
    importUserData,
} = require('../../services/userDataTransfer');
const permissionsService = require('../../services/permissionsService');
const { createTestUser } = require('../helpers/testUtils');
const { eraseUserAccount } = require('../../services/accountErasureService');

const config = getConfig();

const selfPersonOf = (userId) =>
    Person.findOne({ where: { user_id: userId, linked_user_id: userId } });

async function canLogin(email, password) {
    const response = await request(app)
        .post('/api/login')
        .send({ email, password });
    return response.status === 200;
}

// An admin who created two members (one without an email), shared things
// with them directly and through a group, assigned them work, and a member
// with a project of their own.
async function seedInstance() {
    const stamp = Date.now();
    const admin = await createTestUser({
        email: `inst-admin_${stamp}@example.com`,
        name: 'Admin',
    });
    const member = await createTestUser({
        email: `inst-member_${stamp}@example.com`,
        name: 'Member',
    });
    await member.update({ created_by_user_id: admin.id });
    const kid = await User.create({
        name: 'Kid',
        created_by_user_id: admin.id,
    });

    await Role.destroy({ where: {} });
    await Role.create({ user_id: admin.id, is_admin: true, role: 'admin' });
    await Role.create({ user_id: member.id, is_admin: false, role: 'user' });
    await Role.create({ user_id: kid.id, is_admin: false, role: 'guest' });

    const sharedProject = await Project.create({
        name: 'Household',
        user_id: admin.id,
    });
    await Permission.create({
        user_id: member.id,
        resource_type: 'project',
        resource_uid: sharedProject.uid,
        access_level: 'ro',
        granted_by_user_id: admin.id,
        status: 'accepted',
    });

    const groupProject = await Project.create({
        name: 'Holidays',
        user_id: admin.id,
    });
    const group = await UserGroup.create({ name: `Family ${stamp}` });
    for (const user of [member, kid]) {
        await UserGroupMember.create({ group_id: group.id, user_id: user.id });
    }
    const groupShare = await GroupShare.create({
        group_id: group.id,
        resource_type: 'project',
        resource_uid: groupProject.uid,
        access_level: 'rw',
        granted_by_user_id: admin.id,
    });
    for (const user of [member, kid]) {
        await GroupPermission.create({
            group_share_id: groupShare.id,
            user_id: user.id,
            resource_type: 'project',
            resource_uid: groupProject.uid,
            access_level: 'rw',
            granted_by_user_id: admin.id,
            status: 'accepted',
        });
    }

    const memberSelf = await selfPersonOf(member.id);
    const adminSelf = await selfPersonOf(admin.id);
    await Task.create({
        name: 'Take out the bins',
        user_id: admin.id,
        project_id: sharedProject.id,
        assigned_to: memberSelf.uid,
    });
    await Person.create({
        name: 'Kid card',
        user_id: admin.id,
        linked_user_id: kid.id,
    });

    const imageName = `project-instance-${stamp}.png`;
    const projectsDir = path.join(config.uploadPath, 'projects');
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.writeFile(path.join(projectsDir, imageName), 'member cover');
    const memberProject = await Project.create({
        name: 'Garden',
        user_id: member.id,
        image_url: `/api/uploads/projects/${imageName}`,
    });
    await Task.create({
        name: 'Ask admin about seeds',
        user_id: member.id,
        project_id: memberProject.id,
        assigned_to: adminSelf.uid,
    });

    return {
        admin,
        member,
        kid,
        group,
        sharedProject,
        groupProject,
        memberProject,
        imageName,
    };
}

// A new install: a fresh admin, and none of the old accounts left.
async function freshInstall(seeded) {
    const freshAdmin = await createTestUser({
        email: `inst-fresh_${Date.now()}@example.com`,
        name: 'Fresh',
    });
    await Role.destroy({ where: { user_id: freshAdmin.id } });
    await Role.create({
        user_id: freshAdmin.id,
        is_admin: true,
        role: 'admin',
    });

    const shares = await GroupShare.findAll({
        where: { group_id: seeded.group.id },
    });
    await GroupPermission.destroy({
        where: { group_share_id: shares.map((s) => s.id) },
    });
    await GroupShare.destroy({ where: { group_id: seeded.group.id } });
    await UserGroupMember.destroy({ where: { group_id: seeded.group.id } });
    await UserGroup.destroy({ where: { id: seeded.group.id } });

    for (const user of [seeded.member, seeded.kid, seeded.admin]) {
        await eraseUserAccount(user.id);
    }
    return freshAdmin;
}

describe('Instance backup (admin)', () => {
    let seeded;

    beforeEach(async () => {
        seeded = await seedInstance();
    });

    afterEach(async () => {
        await fs.rm(
            path.join(config.uploadPath, 'projects', seeded.imageName),
            { force: true }
        );
    });

    it('carries every other account with its password hash, role and data', async () => {
        const backup = await exportUserData(seeded.admin.id);

        const accounts = backup.instance.accounts;
        const byUid = Object.fromEntries(
            accounts.map((a) => [a.account.uid, a])
        );
        expect(byUid[seeded.member.uid].account.password_digest).toBe(
            seeded.member.password_digest
        );
        expect(byUid[seeded.member.uid].account.created_by_uid).toBe(
            seeded.admin.uid
        );
        expect(byUid[seeded.kid.uid].account.role.role).toBe('guest');
        expect(
            byUid[seeded.member.uid].backup.data.projects.map((p) => p.name)
        ).toEqual(['Garden']);
        expect(byUid[seeded.admin.uid]).toBeUndefined();

        expect(backup.instance.shares).toHaveLength(1);
        expect(backup.instance.group_shares[0].permissions).toHaveLength(2);
        const kidCard = backup.data.people.find((p) => p.name === 'Kid card');
        expect(kidCard.linked_user_uid).toBe(seeded.kid.uid);
    });

    it('restores accounts, their data, shares, assignments and member links on a fresh install (#1673)', async () => {
        const backup = await exportUserData(seeded.admin.id);
        const freshAdmin = await freshInstall(seeded);

        const stats = await importUserData(freshAdmin.id, backup);
        expect(stats.accounts).toEqual({ created: 2, skipped: 0 });
        expect(stats.groups.created).toBe(1);
        expect(stats.shares.created).toBe(2);

        const member = await User.findOne({
            where: { uid: seeded.member.uid },
        });
        const kid = await User.findOne({ where: { uid: seeded.kid.uid } });
        expect(member.email).toBe(seeded.member.email);
        expect(member.created_by_user_id).toBe(freshAdmin.id);
        expect(kid.email).toBeNull();
        expect((await Role.findOne({ where: { user_id: kid.id } })).role).toBe(
            'guest'
        );
        expect(
            (await Role.findOne({ where: { user_id: member.id } })).is_admin
        ).toBe(false);
        expect(await canLogin(member.email, 'password123')).toBe(true);

        // The member's own project and its cover image
        const garden = await Project.findOne({
            where: { user_id: member.id, name: 'Garden' },
        });
        expect(garden.image_url).toMatch(/^\/api\/uploads\/projects\//);
        const imageFile = path.join(
            config.uploadPath,
            'projects',
            path.basename(garden.image_url)
        );
        expect(await fs.readFile(imageFile, 'utf8')).toBe('member cover');
        await fs.rm(imageFile, { force: true });

        // Shares, direct and through the group
        const household = await Project.findOne({
            where: { user_id: freshAdmin.id, name: 'Household' },
        });
        const holidays = await Project.findOne({
            where: { user_id: freshAdmin.id, name: 'Holidays' },
        });
        expect(
            await permissionsService.getAccess(
                member.id,
                'project',
                household.uid
            )
        ).toBe('ro');
        expect(
            await permissionsService.getAccess(kid.id, 'project', holidays.uid)
        ).toBe('rw');

        // Assignments across accounts point at the restored people
        const memberSelf = await selfPersonOf(member.id);
        const adminSelf = await selfPersonOf(freshAdmin.id);
        const bins = await Task.findOne({
            where: { user_id: freshAdmin.id, name: 'Take out the bins' },
        });
        expect(bins.assigned_to).toBe(memberSelf.uid);
        const seeds = await Task.findOne({
            where: { user_id: member.id, name: 'Ask admin about seeds' },
        });
        expect(seeds.assigned_to).toBe(adminSelf.uid);

        // The admin's card for the kid links to the kid's account again
        const kidCard = await Person.findOne({
            where: { user_id: freshAdmin.id, name: 'Kid card' },
        });
        expect(kidCard.linked_user_id).toBe(kid.id);
    });

    it('restoring twice creates no duplicates and never changes a password', async () => {
        const backup = await exportUserData(seeded.admin.id);
        const freshAdmin = await freshInstall(seeded);
        await importUserData(freshAdmin.id, backup);

        const member = await User.findOne({
            where: { uid: seeded.member.uid },
        });
        await member.update({ password: 'changed-after-restore' });
        const { password_digest: hashBefore } = await User.findByPk(member.id);

        const stats = await importUserData(freshAdmin.id, backup);
        expect(stats.accounts).toEqual({ created: 0, skipped: 2 });
        expect(stats.shares.created).toBe(0);
        expect(await User.count({ where: { uid: seeded.member.uid } })).toBe(1);
        expect(
            await Project.count({
                where: { user_id: member.id, name: 'Garden' },
            })
        ).toBe(1);
        expect((await User.findByPk(member.id)).password_digest).toBe(
            hashBefore
        );

        const garden = await Project.findOne({
            where: { user_id: member.id, name: 'Garden' },
        });
        await fs.rm(
            path.join(
                config.uploadPath,
                'projects',
                path.basename(garden.image_url)
            ),
            { force: true }
        );
    });

    it('keeps backups per user for non-admins', async () => {
        const backup = await exportUserData(seeded.member.id);
        expect(backup.instance).toBeUndefined();

        const adminBackup = await exportUserData(seeded.admin.id);
        const outsider = await createTestUser({
            email: `inst-outsider_${Date.now()}@example.com`,
        });
        const usersBefore = await User.count();
        const stats = await importUserData(outsider.id, adminBackup);
        expect(stats.accounts).toBeUndefined();
        expect(await User.count()).toBe(usersBefore);
    });

    it('never adds accounts to a hosted instance backup', async () => {
        const wasHosted = config.hosted.enabled;
        config.hosted.enabled = true;
        try {
            const backup = await exportUserData(seeded.admin.id);
            expect(backup.instance).toBeUndefined();
        } finally {
            config.hosted.enabled = wasHosted;
        }
    });
});
