'use strict';

const adminRepository = require('./repository');
const { accountStatusOf } = require('./accountStatus');
const membersService = require('../members/service');
const {
    validateRoleChange,
    validateUserId,
    validatePersonName,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateToggleRegistration,
    validateOidcConfig,
} = require('./validation');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
    UnauthorizedError,
    ConflictError,
} = require('../../shared/errors');
const rolesService = require('../../services/rolesService');
const { isAdmin } = rolesService;
const { sequelize } = require('../../models');
const { destroyUserSessions } = require('../../services/sessionService');
const { getConfig } = require('../../config/config');

class AdminService {
    /**
     * Check if requester is admin or if bootstrapping (no roles yet).
     */
    async verifyAdminOrBootstrap(requesterId) {
        if (!requesterId) {
            throw new UnauthorizedError('Authentication required');
        }

        const requester = await adminRepository.findUserUidById(requesterId);
        if (!requester) {
            throw new UnauthorizedError('Authentication required');
        }

        const requesterIsAdmin = await isAdmin(requester.uid);
        if (requesterIsAdmin) {
            return true;
        }

        // Bootstrap fallback: an instance with no roles at all lets any user
        // claim admin so it cannot lock itself out. Never on a hosted
        // instance, where the roles table being empty would hand the whole
        // instance to whoever asks first.
        const hosted = getConfig().hosted?.enabled === true;
        const existingRolesCount = await adminRepository.countRoles();

        if (hosted || existingRolesCount > 0) {
            throw new ForbiddenError('Forbidden');
        }

        return true;
    }

    /**
     * Check if requester is admin.
     */
    async verifyAdmin(requesterId) {
        if (!requesterId) {
            throw new UnauthorizedError('Authentication required');
        }

        const user = await adminRepository.findUserUidById(requesterId);
        if (!user) {
            throw new UnauthorizedError('Authentication required');
        }

        const admin = await isAdmin(user.uid);
        if (!admin) {
            throw new ForbiddenError('Forbidden');
        }

        return true;
    }

    /**
     * Set admin role for a user.
     */
    async setAdminRole(requesterId, body) {
        await this.verifyAdminOrBootstrap(requesterId);

        const { user_id, is_admin: makeAdmin } = validateSetAdminRole(body);

        const user = await adminRepository.findUserById(user_id);
        if (!user) {
            throw new ValidationError('Invalid user_id');
        }

        const current = await rolesService.getRoleInfo(user_id);
        if (makeAdmin) {
            await rolesService.setRole(user_id, 'admin');
        } else if (current.role === 'admin') {
            await rolesService.setRole(user_id, 'user');
        }

        return { user_id, is_admin: await isAdmin(user_id) };
    }

    describeRole(row) {
        const role = rolesService.effectiveRole(row);
        return {
            role,
            capabilities: rolesService.effectiveCapabilities(
                role,
                row && row.capabilities
            ),
        };
    }

    async listRoles(requesterId) {
        await this.verifyAdmin(requesterId);
        return rolesService.describeRoles();
    }

    /**
     * List all users with roles.
     */
    async listUsers(requesterId) {
        await this.verifyAdmin(requesterId);

        const users = await adminRepository.findAllUsers();
        const roles = await adminRepository.findAllRoles();
        const userIdToRole = new Map(roles.map((r) => [r.user_id, r]));
        const identityUserIds = await adminRepository.findIdentityUserIds();

        return users.map((u) => ({
            id: u.id,
            email: u.email ?? null,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            account_status: accountStatusOf(u, identityUserIds.has(u.id)),
            ...this.describeRole(userIdToRole.get(u.id)),
        }));
    }

    /**
     * Create a new user.
     */
    async createUser(requesterId, body) {
        await this.verifyAdmin(requesterId);
        return membersService.createMember(requesterId, body);
    }

    /**
     * Update a user.
     */
    async updateUser(requesterId, userId, body, { sessionId = null } = {}) {
        await this.verifyAdmin(requesterId);

        const id = validateUserId(userId);
        const user = await adminRepository.findUserById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { email, password, name, surname, role, capabilities } =
            body || {};
        validateRoleChange(role, capabilities);

        // A blank email leaves the current one alone: an email can be added or
        // changed here, but not taken away, since the account could then no
        // longer be reached.
        if (
            email !== undefined &&
            email !== null &&
            String(email).trim() !== ''
        ) {
            validateEmail(email);
            user.email = email;
        }

        const changesPassword =
            password !== undefined &&
            password !== null &&
            !(typeof password === 'string' && password.trim() === '');
        if (changesPassword) {
            validatePassword(password);
            user.password = password;
            user.changed('password_digest', true);
        }

        if (name !== undefined) user.name = validatePersonName(name, 'Name');
        if (surname !== undefined) {
            user.surname = validatePersonName(surname, 'Surname');
        }

        // The account, its role and its permissions change together or not at
        // all, so refusing a demotion (the last admin) cannot leave a rename
        // or a new password behind.
        try {
            await sequelize.transaction(async (transaction) => {
                await user.save({ transaction });
                if (role !== undefined) {
                    await rolesService.setRole(user.id, role, { transaction });
                }
                if (capabilities !== undefined) {
                    await rolesService.setCapabilities(user.id, capabilities, {
                        transaction,
                    });
                }
            });
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        // A new password signs the account out everywhere, the way a reset
        // does, so a session opened with the old one stops working. The admin
        // changing their own password keeps the session they are using.
        if (changesPassword) {
            await destroyUserSessions(user.id, {
                exceptSid: user.id === requesterId ? sessionId : null,
            });
        }

        const userRole = await adminRepository.findRoleByUserId(user.id);

        const identityUserIds = await adminRepository.findIdentityUserIds([
            user.id,
        ]);

        return {
            id: user.id,
            email: user.email ?? null,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            account_status: accountStatusOf(user, identityUserIds.has(user.id)),
            ...this.describeRole(userRole),
        };
    }

    /**
     * Delete a user.
     */
    async deleteUser(requesterId, userId) {
        await this.verifyAdmin(requesterId);

        const id = validateUserId(userId);

        if (id === requesterId) {
            throw new ValidationError('Cannot delete your own account');
        }

        const result = await adminRepository.deleteUserWithData(id);

        if (!result.success) {
            if (result.status === 404) {
                throw new NotFoundError(result.error);
            }
            throw new ValidationError(result.error);
        }

        return null;
    }

    /**
     * Toggle registration setting.
     */
    // One page's worth of numbers for the admin dashboard: who is here,
    // what is being sold, and who is waiting for it to open.
    async overview(requesterId) {
        await this.verifyAdmin(requesterId);
        const {
            User,
            Role,
            Task,
            Project,
            Note,
            BillingAccount,
            WaitlistSubscriber,
            Setting,
        } = require('../../models');
        const { getConfig } = require('../../config/config');
        const entitlements = require('../../services/entitlementsService');
        const { Op } = require('sequelize');

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const config = getConfig();

        const [
            users,
            admins,
            verified,
            newUsers,
            tasks,
            projects,
            notes,
            waitlist,
            waitlistWeek,
            paying,
            registrationSetting,
        ] = await Promise.all([
            User.count(),
            Role.count({ where: { is_admin: true } }),
            User.count({ where: { email_verified: true } }),
            User.count({ where: { created_at: { [Op.gte]: dayAgo } } }),
            Task.count(),
            Project.count(),
            Note.count(),
            WaitlistSubscriber.count(),
            WaitlistSubscriber.count({
                where: { created_at: { [Op.gte]: weekAgo } },
            }),
            BillingAccount.count({
                where: { status: { [Op.in]: ['active', 'trialing'] } },
            }),
            Setting.findOne({ where: { key: 'registration_enabled' } }),
        ]);

        return {
            users: { total: users, admins, verified, last24h: newUsers },
            content: { tasks, projects, notes },
            waitlist: { total: waitlist, last7d: waitlistWeek },
            billing: {
                paying,
                hosted: config.hosted?.enabled === true,
                subscription_required: entitlements.isSubscriptionRequired(),
                provider: config.hosted?.billing?.provider || null,
            },
            instance: {
                registration_enabled: registrationSetting
                    ? registrationSetting.value === 'true'
                    : false,
                version: require('../../../package.json').version,
                environment: config.environment,
            },
        };
    }

    // The waitlist, newest first, for the admin dashboard and the waitlist
    // page. `q` narrows it to addresses containing that fragment.
    async listWaitlist(requesterId, { limit = 50, offset = 0, q = '' } = {}) {
        await this.verifyAdmin(requesterId);
        const waitlist = require('../../services/waitlistService');
        return waitlist.list({ limit, offset, q });
    }

    // The whole list as CSV, which is how it gets into a mail provider on
    // launch day.
    async exportWaitlist(requesterId) {
        await this.verifyAdmin(requesterId);
        const waitlist = require('../../services/waitlistService');
        return waitlist.toCsv(await waitlist.all());
    }

    // Removing an address someone asked to be forgotten, or a bad row that
    // will never be mailed anyway.
    async deleteWaitlistEntry(requesterId, id) {
        await this.verifyAdmin(requesterId);
        const numericId = Number(id);
        if (!Number.isInteger(numericId) || numericId <= 0) {
            throw new ValidationError('Invalid id');
        }

        const waitlist = require('../../services/waitlistService');
        const removed = await waitlist.remove(numericId);
        if (!removed) {
            throw new NotFoundError('Waitlist entry not found');
        }
    }

    async toggleRegistration(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const { enabled } = validateToggleRegistration(body);

        const {
            setRegistrationEnabled,
        } = require('../auth/registrationService');
        await setRegistrationEnabled(enabled);

        return { enabled };
    }

    /**
     * Get the current OIDC/SSO provider configuration (masked secrets),
     * for the admin panel in Profile Settings -> OIDC/SSO.
     */
    async getOidcConfig(requesterId) {
        await this.verifyAdmin(requesterId);

        const oidcConfigService = require('../oidc/configService');
        return oidcConfigService.getMaskedConfig();
    }

    /**
     * Replace the OIDC/SSO provider configuration.
     */
    async updateOidcConfig(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const validated = validateOidcConfig(body);

        const oidcConfigService = require('../oidc/configService');
        return oidcConfigService.saveConfig(validated);
    }
}

module.exports = new AdminService();
