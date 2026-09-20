const rolesService = require('../../../services/rolesService');
const { Role, sequelize } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('roles and capabilities', () => {
    let admin, member;

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        member = await createTestUser({ email: 'member@example.com' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('getRoleInfo', () => {
        it('gives the first account the admin role with every capability', async () => {
            const info = await rolesService.getRoleInfo(admin.id);

            expect(info.role).toBe('admin');
            expect(info.capabilities).toEqual({
                create_people: true,
                invite_members: true,
                create_projects: true,
            });
        });

        it('gives a later account the user role without invite rights', async () => {
            const info = await rolesService.getRoleInfo(member.id);

            expect(info.role).toBe('user');
            expect(info.capabilities).toEqual({
                create_people: true,
                invite_members: false,
                create_projects: true,
            });
        });

        it('gives a guest no capabilities', async () => {
            await rolesService.setRole(member.id, 'guest');

            const info = await rolesService.getRoleInfo(member.id);

            expect(info.role).toBe('guest');
            expect(info.capabilities).toEqual({
                create_people: false,
                invite_members: false,
                create_projects: false,
            });
        });

        it('treats an account with no role row as a user', async () => {
            await Role.destroy({ where: { user_id: member.id } });

            const info = await rolesService.getRoleInfo(member.id);

            expect(info.role).toBe('user');
        });

        it('still follows the admin flag when only that column is changed', async () => {
            await Role.update(
                { is_admin: true },
                { where: { user_id: member.id } }
            );

            expect((await rolesService.getRoleInfo(member.id)).role).toBe(
                'admin'
            );

            await Role.update(
                { is_admin: false },
                { where: { user_id: admin.id } }
            );

            expect((await rolesService.getRoleInfo(admin.id)).role).toBe(
                'user'
            );
        });
    });

    describe('capability overrides', () => {
        it('lets one user invite others without changing their role', async () => {
            await rolesService.setCapabilities(member.id, {
                invite_members: true,
            });

            const info = await rolesService.getRoleInfo(member.id);

            expect(info.role).toBe('user');
            expect(info.capabilities.invite_members).toBe(true);
            expect(await rolesService.can(member.id, 'invite_members')).toBe(
                true
            );
        });

        it('lets a capability be taken away from a user', async () => {
            await rolesService.setCapabilities(member.id, {
                create_projects: false,
            });

            expect(await rolesService.can(member.id, 'create_projects')).toBe(
                false
            );
            expect(await rolesService.can(member.id, 'create_people')).toBe(
                true
            );
        });

        it('keeps only the differences from the role defaults', async () => {
            await rolesService.setCapabilities(member.id, {
                create_people: true,
                invite_members: true,
            });

            const row = await Role.findOne({ where: { user_id: member.id } });

            expect(row.capabilities).toEqual({ invite_members: true });
        });

        it('cannot take capabilities away from an admin', async () => {
            await rolesService.setCapabilities(admin.id, {
                invite_members: false,
            });

            expect(await rolesService.can(admin.id, 'invite_members')).toBe(
                true
            );
        });

        it('rejects a capability that does not exist', async () => {
            await expect(
                rolesService.setCapabilities(member.id, { fly: true })
            ).rejects.toThrow(/Unknown capability/);
        });

        it('rejects a value that is not true or false', async () => {
            await expect(
                rolesService.setCapabilities(member.id, {
                    invite_members: 'yes',
                })
            ).rejects.toThrow(/true or false/);
        });
    });

    describe('setRole', () => {
        it('keeps the admin flag in step with the role', async () => {
            await rolesService.setRole(member.id, 'admin');
            let row = await Role.findOne({ where: { user_id: member.id } });
            expect(row.role).toBe('admin');
            expect(row.is_admin).toBe(true);

            await rolesService.setRole(member.id, 'guest');
            row = await Role.findOne({ where: { user_id: member.id } });
            expect(row.role).toBe('guest');
            expect(row.is_admin).toBe(false);
        });

        it('creates the row when an account has none', async () => {
            await Role.destroy({ where: { user_id: member.id } });

            await rolesService.setRole(member.id, 'guest');

            expect((await rolesService.getRoleInfo(member.id)).role).toBe(
                'guest'
            );
        });

        it('rejects a role that does not exist', async () => {
            await expect(
                rolesService.setRole(member.id, 'owner')
            ).rejects.toThrow(/Unknown role/);
        });

        it('refuses to demote the last admin', async () => {
            await expect(
                rolesService.setRole(admin.id, 'user')
            ).rejects.toThrow(/last admin/);

            expect(await rolesService.isAdmin(admin.id)).toBe(true);
        });

        it('allows demoting an admin when another admin remains', async () => {
            await rolesService.setRole(member.id, 'admin');

            await rolesService.setRole(admin.id, 'user');

            expect(await rolesService.isAdmin(admin.id)).toBe(false);
            expect(await rolesService.isAdmin(member.id)).toBe(true);
        });
    });

    describe('can', () => {
        it('is false for an unknown account and an unknown capability', async () => {
            expect(await rolesService.can(999999, 'create_people')).toBe(false);
            expect(await rolesService.can(member.id, 'fly')).toBe(false);
            expect(await rolesService.can(null, 'create_people')).toBe(false);
        });
    });

    describe('describeRoles', () => {
        it('lists the three roles with their defaults and how many hold each', async () => {
            await rolesService.setRole(
                (await createTestUser({ email: 'guest@example.com' })).id,
                'guest'
            );

            const { roles, capabilities } = await rolesService.describeRoles();

            expect(capabilities).toEqual([
                'create_people',
                'invite_members',
                'create_projects',
            ]);
            expect(roles.map((r) => r.id)).toEqual(['admin', 'user', 'guest']);
            expect(
                Object.fromEntries(roles.map((r) => [r.id, r.member_count]))
            ).toEqual({ admin: 1, user: 1, guest: 1 });
            expect(roles.find((r) => r.id === 'guest').capabilities).toEqual({
                create_people: false,
                invite_members: false,
                create_projects: false,
            });
        });
    });
});
