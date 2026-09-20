'use strict';

const adminRepository = require('./repository');
const {
    validateRoleChange,
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
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
const {
    getDefaultNotificationPreferences,
} = require('../../utils/notificationPreferences');
const { logError } = require('../../services/logService');
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

        return users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            ...this.describeRole(userIdToRole.get(u.id)),
        }));
    }

    /**
     * Create a new user.
     */
    async createUser(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const {
            email,
            password,
            name,
            surname,
            role,
            capabilities,
            requireVerification,
        } = validateCreateUser(body);
        const { linked_person_uid } = body || {};
        const invite = !password;
        // An invite already verifies the email when its link is used, so the
        // switch only matters for accounts that are given a password.
        const verify = requireVerification && !invite;

        const userData = {
            email,
            notification_preferences: getDefaultNotificationPreferences(),
        };
        if (password) {
            userData.password = password;
            if (verify) userData.email_verified = false;
        } else {
            // No password yet: the account is inert until the invite link is
            // used, which also verifies the email.
            userData.email_verified = false;
        }
        if (name) userData.name = name;
        if (surname) userData.surname = surname;

        let user;
        try {
            user = await adminRepository.createUser(userData);
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        if (role && role !== 'user') {
            await rolesService.setRole(user.id, role);
        }
        if (capabilities) {
            await rolesService.setCapabilities(user.id, capabilities);
        }

        if (linked_person_uid) {
            const { Person } = require('../../models');
            const person = await Person.findOne({
                where: { uid: linked_person_uid, user_id: requesterId },
            });
            if (person && person.linked_user_id == null) {
                await person.update({ linked_user_id: user.id });
            }
        }

        const peopleService = require('../people/service');
        try {
            await peopleService.createSelfPerson(user);
        } catch (err) {
            logError(
                err,
                'Failed to create self-person for admin-created user'
            );
        }

        let emailSent = false;
        if (verify) {
            const {
                resendVerificationEmail,
            } = require('../auth/registrationService');
            try {
                const result = await resendVerificationEmail(user.email);
                emailSent = result.sent;
            } catch (err) {
                // The account stays; the admin can verify it by hand.
                logError(err, 'Failed to send verification email');
            }
        }
        if (invite) {
            const {
                sendMemberInviteEmail,
            } = require('../auth/passwordResetService');
            try {
                const result = await sendMemberInviteEmail(user);
                emailSent = result.sent;
            } catch (err) {
                // The account stays; the admin can resend or set a password.
                logError(err, 'Failed to send member invite email');
            }
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            ...(await rolesService.getRoleInfo(user.id)),
            invited: invite,
            verification_requested: verify,
            email_sent: emailSent,
        };
    }

    /**
     * Update a user.
     */
    async updateUser(requesterId, userId, body) {
        await this.verifyAdmin(requesterId);

        const id = validateUserId(userId);
        const user = await adminRepository.findUserById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { email, password, name, surname, role, capabilities } =
            body || {};
        validateRoleChange(role, capabilities);

        if (email !== undefined && email !== null) {
            validateEmail(email);
            user.email = email;
        }

        if (password && password.trim() !== '') {
            validatePassword(password);
            user.password = password;
            user.changed('password_digest', true);
        }

        if (name !== undefined) user.name = name || null;
        if (surname !== undefined) user.surname = surname || null;

        try {
            await user.save();
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        if (role !== undefined) {
            await rolesService.setRole(user.id, role);
        }
        if (capabilities !== undefined) {
            await rolesService.setCapabilities(user.id, capabilities);
        }

        const userRole = await adminRepository.findRoleByUserId(user.id);

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
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
