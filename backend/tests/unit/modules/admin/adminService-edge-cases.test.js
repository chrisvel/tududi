jest.mock('../../../../services/seatsService', () => ({
    ...jest.requireActual('../../../../services/seatsService'),
    reconcile: jest.fn(),
}));

const adminService = require('../../../../modules/admin/service');
const adminRepository = require('../../../../modules/admin/repository');
const rolesService = require('../../../../services/rolesService');
const accountsService = require('../../../../services/accountsService');
const seatsService = require('../../../../services/seatsService');
const { Role, Setting, User } = require('../../../../models');
const { getConfig } = require('../../../../config/config');
const { createTestUser } = require('../../../helpers/testUtils');
const {
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} = require('../../../../shared/errors');

const config = getConfig();
let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `admin-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });
const makeAdmin = (user) =>
    Role.update(
        { is_admin: true, role: 'admin' },
        { where: { user_id: user.id } }
    );

// The admin checks and actions on the paths the integration tests do not
// take: no requester, a requester that is gone, bootstrapping an instance
// with no roles, demotions, failed deletions, an empty dashboard config and
// bad waitlist ids.
describe('adminService edge cases', () => {
    let admin;

    beforeEach(async () => {
        admin = await newUser();
        await Role.update({ is_admin: false }, { where: {} });
        await makeAdmin(admin);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        jest.restoreAllMocks();
    });

    describe('who may act', () => {
        it.each([
            ['verifyAdmin', null, UnauthorizedError],
            ['verifyAdmin', 987654, UnauthorizedError],
            ['verifyAdminOrBootstrap', null, UnauthorizedError],
            ['verifyAdminOrBootstrap', 987654, UnauthorizedError],
            ['accessScope', null, UnauthorizedError],
        ])('%s(%p) refuses', async (method, requester, ErrorType) => {
            await expect(
                adminService[method](requester)
            ).rejects.toBeInstanceOf(ErrorType);
        });

        it('lets anyone claim admin on a self-hosted instance with no roles', async () => {
            const user = await newUser();
            await Role.destroy({ where: {} });
            expect(await adminService.verifyAdminOrBootstrap(user.id)).toBe(
                true
            );
        });

        it('never bootstraps an admin on a hosted instance', async () => {
            const user = await newUser();
            await Role.destroy({ where: {} });
            config.hosted.enabled = true;
            await expect(
                adminService.verifyAdminOrBootstrap(user.id)
            ).rejects.toBeInstanceOf(ForbiddenError);
        });

        it('refuses an account admin whose account cannot be found', async () => {
            const user = await newUser();
            jest.spyOn(rolesService, 'isAccountAdmin').mockResolvedValue(true);
            jest.spyOn(accountsService, 'getAccount').mockResolvedValue(null);
            await expect(
                adminService.accessScope(user.id)
            ).rejects.toBeInstanceOf(ForbiddenError);
        });
    });

    describe('setAdminRole', () => {
        it('refuses an account that does not exist', async () => {
            await expect(
                adminService.setAdminRole(admin.id, {
                    user_id: 987654,
                    is_admin: true,
                })
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('demotes an admin and leaves a non-admin as it is', async () => {
            const other = await newUser();
            await makeAdmin(other);

            expect(
                await adminService.setAdminRole(admin.id, {
                    user_id: other.id,
                    is_admin: false,
                })
            ).toEqual({ user_id: other.id, is_admin: false });
            expect(
                await adminService.setAdminRole(admin.id, {
                    user_id: other.id,
                    is_admin: false,
                })
            ).toEqual({ user_id: other.id, is_admin: false });
        });
    });

    describe('users', () => {
        it('updates nothing when given no body', async () => {
            const other = await newUser({ name: 'Same' });
            const result = await adminService.updateUser(admin.id, other.id);
            expect(result.name).toBe('Same');
        });

        it('lets an account admin send an empty update', async () => {
            config.hosted.enabled = true;
            const owner = await newUser({ name: 'Owner' });
            const result = await adminService.updateUser(owner.id, owner.id);
            expect(result.id).toBe(owner.id);
        });

        it('reports a deletion the repository refused', async () => {
            const other = await newUser();
            jest.spyOn(adminRepository, 'deleteUserWithData').mockResolvedValue(
                {
                    success: false,
                    status: 400,
                    error: 'Cannot delete the last remaining admin',
                }
            );
            await expect(
                adminService.deleteUser(admin.id, other.id)
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it("frees a member's seat when the superadmin deletes it", async () => {
            config.hosted.enabled = true;
            const owner = await newUser();
            const member = await newUser({ created_by_user_id: owner.id });

            await adminService.deleteUser(admin.id, member.id);

            expect(await User.findByPk(member.id)).toBeNull();
            expect(seatsService.reconcile).toHaveBeenCalledWith(owner.id);
        });
    });

    describe('dashboard and settings', () => {
        it('shows no billing provider and the registration setting', async () => {
            const savedProvider = config.hosted.billing.provider;
            config.hosted.billing.provider = undefined;
            await Setting.upsert({
                key: 'registration_enabled',
                value: 'true',
            });
            try {
                const overview = await adminService.overview(admin.id);
                expect(overview.billing.provider).toBeNull();
                expect(overview.instance.registration_enabled).toBe(true);
            } finally {
                config.hosted.billing.provider = savedProvider;
            }
        });

        it('lists the waitlist with its default page', async () => {
            const result = await adminService.listWaitlist(admin.id);
            expect(result).toBeDefined();
        });

        it.each(['abc', '0', '-3', '1.5'])(
            'refuses waitlist id %p',
            async (id) => {
                await expect(
                    adminService.deleteWaitlistEntry(admin.id, id)
                ).rejects.toBeInstanceOf(ValidationError);
            }
        );

        it('refuses to remove a waitlist entry that does not exist', async () => {
            await expect(
                adminService.deleteWaitlistEntry(admin.id, '987654')
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it('turns registration on and off', async () => {
            expect(
                await adminService.toggleRegistration(admin.id, {
                    enabled: true,
                })
            ).toEqual({ enabled: true });
            expect(
                await adminService.toggleRegistration(admin.id, {
                    enabled: false,
                })
            ).toEqual({ enabled: false });
        });
    });
});
