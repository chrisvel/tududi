const rolesService = require('../../../services/rolesService');
const { Role, User } = require('../../../models');
const { getConfig } = require('../../../config/config');
const { createTestUser } = require('../../helpers/testUtils');
const { ValidationError } = require('../../../shared/errors');

const config = getConfig();
let counter = 0;
const newUser = () =>
    createTestUser({
        email: `roles-edge-${Date.now()}-${++counter}@example.com`,
    });

// Inputs the role helpers accept but the rest of the suite never sends: ids
// as text, stored permissions as text, no user at all, and a user who has no
// role row yet.
describe('rolesService edge cases', () => {
    afterEach(() => {
        config.hosted.enabled = false;
    });

    it('reads a numeric id given as text', async () => {
        const user = await newUser();
        await Role.update({ is_admin: true }, { where: { user_id: user.id } });
        expect(await rolesService.isAdmin(String(user.id))).toBe(true);
    });

    it('reads permissions stored as text', () => {
        expect(
            rolesService.effectiveCapabilities(
                'user',
                '{"create_projects":false}'
            )
        ).toEqual({
            create_people: true,
            invite_members: false,
            create_projects: false,
        });
    });

    it('ignores stored permissions it cannot read', () => {
        const defaults = rolesService.ROLE_DEFAULTS.user;
        expect(rolesService.effectiveCapabilities('user', 'not json')).toEqual(
            defaults
        );
        expect(rolesService.effectiveCapabilities('user', 'null')).toEqual(
            defaults
        );
    });

    it('describes no user as a plain user', async () => {
        expect(await rolesService.getRoleInfo(null)).toEqual({
            role: 'user',
            capabilities: rolesService.ROLE_DEFAULTS.user,
        });
    });

    it('refuses to set a role or permissions for an account that does not exist', async () => {
        await expect(
            rolesService.setRole('no-such-uid', 'user')
        ).rejects.toBeInstanceOf(ValidationError);
        await expect(
            rolesService.setCapabilities('no-such-uid', {
                create_projects: false,
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('creates the role row when permissions are set for an account without one', async () => {
        const user = await newUser();
        await Role.destroy({ where: { user_id: user.id } });

        await rolesService.setCapabilities(user.id, {
            create_projects: false,
        });

        const row = await Role.findOne({ where: { user_id: user.id } });
        expect(row.role).toBe('user');
        expect(row.is_admin).toBe(false);
        expect(
            rolesService.effectiveCapabilities('user', row.capabilities)
                .create_projects
        ).toBe(false);
    });

    it('treats an account without a role row as a user', async () => {
        const user = await newUser();
        await Role.destroy({ where: { user_id: user.id } });

        expect(await rolesService.can(user.id, 'create_projects')).toBe(true);
        expect(await rolesService.can(user.id, 'invite_members')).toBe(false);
    });

    it('clears overrides when no permissions are given', async () => {
        const user = await newUser();
        await rolesService.setCapabilities(user.id, { create_projects: false });

        await rolesService.setCapabilities(user.id, undefined);

        const row = await Role.findOne({ where: { user_id: user.id } });
        expect(row.capabilities).toBeNull();
    });

    it('lets a hosted instance get its first superadmin', async () => {
        const user = await newUser();
        await Role.update({ is_admin: false }, { where: {} });
        config.hosted.enabled = true;

        await rolesService.setRole(user.id, 'admin');

        expect(await rolesService.isAdmin(user.id)).toBe(true);
        expect(await User.findByPk(user.id)).not.toBeNull();
    });
});
