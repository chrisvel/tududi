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
const seatsService = require('../../services/seatsService');
const accountsService = require('../../services/accountsService');
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

    // Who may open the Access page (users, groups, roles) and what it shows:
    // the instance admin sees everyone; on a hosted instance an admin of a
    // customer account sees only its account. Anyone else is refused.
    async accessScope(requesterId) {
        if (!requesterId) {
            throw new UnauthorizedError('Authentication required');
        }
        if (await isAdmin(requesterId)) return { superadmin: true };
        if (await rolesService.isAccountAdmin(requesterId)) {
            const account = await accountsService.getAccount(requesterId);
            if (account) {
                const userIds = await accountsService.getUserIds(account.id);
                return {
                    superadmin: false,
                    accountId: account.id,
                    ownerId: account.owner_user_id,
                    userIds,
                };
            }
        }
        throw new ForbiddenError('Forbidden');
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
        const scope = await this.accessScope(requesterId);
        return scope.superadmin
            ? rolesService.describeRoles()
            : rolesService.describeRoles({ userIds: scope.userIds });
    }

    /**
     * List all users with roles.
     */
    async listUsers(requesterId) {
        const scope = await this.accessScope(requesterId);
        const userIds = scope.superadmin ? null : scope.userIds;

        const users = await adminRepository.findAllUsers(userIds);
        const roles = await adminRepository.findAllRoles(userIds);
        const userIdToRole = new Map(roles.map((r) => [r.user_id, r]));
        const identityUserIds =
            await adminRepository.findIdentityUserIds(userIds);
        const hosted = accountsService.isHosted();
        const ownerIds = hosted
            ? await adminRepository.findAccountOwnerIds(
                  scope.superadmin ? null : [scope.accountId]
              )
            : new Set();

        return users.map((u) => ({
            id: u.id,
            email: u.email ?? null,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            email_verified: !!u.email_verified,
            account_status: accountStatusOf(u, identityUserIds.has(u.id)),
            ...this.describeRole(userIdToRole.get(u.id)),
            ...(hosted ? { is_account_owner: ownerIds.has(u.id) } : {}),
        }));
    }

    /**
     * Create a new user.
     */
    async createUser(requesterId, body) {
        await this.accessScope(requesterId);
        return membersService.createMember(requesterId, body);
    }

    // What an admin of a hosted account may change on someone in its
    // account. The owner stays an admin (setRole refuses), only the person
    // themself changes an email they already have, and a password is set
    // only for a user or a guest, never for another admin.
    async assertAccountAdminMayUpdate(scope, requesterId, user, body) {
        if (!scope.userIds.includes(user.id)) {
            throw new NotFoundError('User not found');
        }
        const { email, password, role } = body || {};
        if (role === 'admin') {
            throw new ForbiddenError('Only an admin can create an admin');
        }
        const self = user.id === requesterId;
        const changesEmail =
            email !== undefined &&
            email !== null &&
            String(email).trim() !== '' &&
            String(email).trim().toLowerCase() !== user.email;
        if (changesEmail && user.email && !self) {
            throw new ForbiddenError(
                'Only the account holder can change their email address'
            );
        }
        const changesPassword =
            password !== undefined &&
            password !== null &&
            !(typeof password === 'string' && password.trim() === '');
        if (changesPassword && !self) {
            const targetRole = rolesService.effectiveRole(
                await adminRepository.findRoleByUserId(user.id)
            );
            if (targetRole === 'admin' || targetRole === 'account_admin') {
                throw new ForbiddenError(
                    'Only the account holder can change an admin password'
                );
            }
        }
    }

    /**
     * Update a user.
     */
    async updateUser(requesterId, userId, body, { sessionId = null } = {}) {
        const scope = await this.accessScope(requesterId);

        const id = validateUserId(userId);
        const user = await adminRepository.findUserById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { email, password, name, surname, role, capabilities } =
            body || {};
        validateRoleChange(role, capabilities);
        if (!scope.superadmin) {
            await this.assertAccountAdminMayUpdate(
                scope,
                requesterId,
                user,
                body
            );
        }

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
            email_verified: !!user.email_verified,
            account_status: accountStatusOf(user, identityUserIds.has(user.id)),
            ...this.describeRole(userRole),
        };
    }

    /**
     * Delete a user.
     */
    async deleteUser(requesterId, userId) {
        const scope = await this.accessScope(requesterId);

        const id = validateUserId(userId);

        if (id === requesterId) {
            throw new ValidationError('Cannot delete your own account');
        }

        // An admin of a hosted account removes members of its account (never
        // its owner) the way the People page does, seat included.
        if (!scope.superadmin) {
            if (id === scope.ownerId) {
                throw new ForbiddenError('The account owner cannot be removed');
            }
            if (!scope.userIds.includes(id)) {
                throw new NotFoundError('User not found');
            }
            await membersService.removeMember(requesterId, id);
            return null;
        }

        const target = await adminRepository.findUserById(id);
        const payerId = target
            ? await accountsService.getOwnerId(target.id)
            : null;
        const result = await adminRepository.deleteUserWithData(id);

        if (!result.success) {
            if (result.status === 404) {
                throw new NotFoundError(result.error);
            }
            throw new ValidationError(result.error);
        }

        // Deleting a member frees its seat on the owner's subscription.
        if (payerId != null && payerId !== id) {
            await seatsService.reconcile(payerId);
        }

        return null;
    }

    /**
     * Toggle registration setting.
     */
    // One page's worth of numbers for the admin dashboard: who is here,
    // what is being sold, and who is waiting for it to open.
    // Everyone on the instance with how they got here and where they stand:
    // signed up themselves or added as a member, verified, on the trial
    // (and the days left), paying, comped, or an ended trial waiting to be
    // deleted. The admin dashboard lists it, newest first.
    async userStatuses(requesterId) {
        await this.verifyAdmin(requesterId);
        const { User, Role, Account, BillingAccount } = require('../../models');
        const entitlements = require('../../services/entitlementsService');
        const hosted = entitlements.isHostedMode();
        const now = new Date();
        const DAY_MS = 24 * 60 * 60 * 1000;

        const [users, adminRoles, accounts, billingRows, identityIds, usage] =
            await Promise.all([
                User.findAll({
                    attributes: [
                        'id',
                        'email',
                        'name',
                        'surname',
                        'created_at',
                        'email_verified',
                        'password_digest',
                        'account_id',
                    ],
                    order: [['created_at', 'DESC']],
                }),
                Role.findAll({
                    where: { is_admin: true },
                    attributes: ['user_id'],
                    raw: true,
                }),
                hosted
                    ? Account.findAll({
                          attributes: ['id', 'owner_user_id'],
                          raw: true,
                      })
                    : [],
                hosted ? BillingAccount.findAll() : [],
                adminRepository.findIdentityUserIds(null),
                adminRepository.countItemsByUser(),
            ]);

        const adminIds = new Set(adminRoles.map((r) => r.user_id));
        const ownerByAccount = new Map(
            accounts.map((a) => [a.id, a.owner_user_id])
        );
        const billingByUser = new Map(billingRows.map((b) => [b.user_id, b]));
        const emailById = new Map(users.map((u) => [u.id, u.email]));
        const resolve = (userId) =>
            entitlements.resolvePlan(billingByUser.get(userId) || null, null, {
                isAdmin: adminIds.has(userId),
                now,
            });

        const usageOf = (entry) => {
            const counts = entry?.counts || {};
            return {
                total: Object.values(counts).reduce((a, b) => a + b, 0),
                counts,
                last_created_at: entry?.last ?? null,
            };
        };

        return {
            hosted,
            users: users.map((u) => {
                const billing = billingByUser.get(u.id) || null;
                const ownerId = u.account_id
                    ? ownerByAccount.get(u.account_id)
                    : null;
                const memberOf = ownerId && ownerId !== u.id ? ownerId : null;
                let access = hosted ? resolve(u.id).reason : 'self_hosted';
                if (access === 'free' && memberOf) access = 'member';

                const trialEnd = billing?.trial_ends_at
                    ? new Date(billing.trial_ends_at)
                    : null;
                const readOnly =
                    access === 'free' && billing
                        ? entitlements.readOnlyUntil(billing)
                        : null;
                // A member is paid for by the owner's subscription.
                const payer = memberOf ? billingByUser.get(memberOf) : billing;
                const payerReason = memberOf
                    ? hosted
                        ? resolve(memberOf).reason
                        : null
                    : access;

                return {
                    id: u.id,
                    email: u.email ?? null,
                    name: [u.name, u.surname].filter(Boolean).join(' ') || null,
                    created_at: u.created_at,
                    email_verified: !!u.email_verified,
                    account_status: accountStatusOf(u, identityIds.has(u.id)),
                    is_admin: adminIds.has(u.id),
                    member_of: memberOf
                        ? { id: memberOf, email: emailById.get(memberOf) }
                        : null,
                    access,
                    trial_ends_at: trialEnd,
                    trial_days_left:
                        access === 'trial' && trialEnd
                            ? Math.max(
                                  1,
                                  Math.ceil(
                                      (trialEnd.getTime() - now.getTime()) /
                                          DAY_MS
                                  )
                              )
                            : null,
                    read_only_until:
                        readOnly && readOnly > now ? readOnly : null,
                    paid:
                        payerReason === 'subscription' ||
                        payerReason === 'grace',
                    subscription_status: payer?.status ?? null,
                    ever_paid: !!payer?.provider_subscription_id,
                    usage: usageOf(usage.get(u.id)),
                };
            }),
        };
    }

    // The last 14 days as UTC days, oldest first, so the dashboard can show
    // this week next to the one before. Signups and waitlist joins per day,
    // how many of this week's signups did anything, who was active, and on
    // a hosted instance the trial and churn signals for the same window.
    async trends(now = new Date()) {
        const {
            User,
            WaitlistSubscriber,
            BillingAccount,
        } = require('../../models');
        const entitlements = require('../../services/entitlementsService');
        const { Op } = require('sequelize');
        const DAY_MS = 24 * 60 * 60 * 1000;
        const DAYS = 14;

        const today = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        );
        const start = new Date(today.getTime() - (DAYS - 1) * DAY_MS);
        const weekStart = new Date(today.getTime() - 6 * DAY_MS);
        const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
        const hosted = entitlements.isHostedMode();

        const [
            signups,
            joins,
            active,
            trialsStarted,
            trialsEnding,
            canceled,
            failed,
        ] = await Promise.all([
            User.findAll({
                attributes: ['id', 'created_at'],
                where: { created_at: { [Op.gte]: start } },
                raw: true,
            }),
            WaitlistSubscriber.findAll({
                attributes: ['created_at'],
                where: { created_at: { [Op.gte]: start } },
                raw: true,
            }),
            adminRepository.findCreatorIdsSince(weekStart),
            hosted
                ? BillingAccount.count({
                      where: { trial_started_at: { [Op.gte]: weekStart } },
                  })
                : 0,
            hosted
                ? BillingAccount.count({
                      where: {
                          trial_ends_at: { [Op.between]: [now, weekAhead] },
                          status: { [Op.notIn]: ['active', 'past_due'] },
                      },
                  })
                : 0,
            hosted
                ? BillingAccount.count({
                      where: { canceled_at: { [Op.gte]: weekStart } },
                  })
                : 0,
            hosted
                ? BillingAccount.count({
                      where: {
                          last_payment_failed_at: { [Op.gte]: weekStart },
                      },
                  })
                : 0,
        ]);

        const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
        const days = Array.from({ length: DAYS }, (_, i) => ({
            date: dayKey(start.getTime() + i * DAY_MS),
            signups: 0,
            waitlist: 0,
        }));
        const byDate = new Map(days.map((d) => [d.date, d]));
        for (const u of signups) {
            const day = byDate.get(dayKey(u.created_at));
            if (day) day.signups += 1;
        }
        for (const w of joins) {
            const day = byDate.get(dayKey(w.created_at));
            if (day) day.waitlist += 1;
        }

        const sum = (list, field) => list.reduce((n, d) => n + d[field], 0);
        const thisWeek = days.slice(7);
        const lastWeek = days.slice(0, 7);
        const newIds = signups
            .filter((u) => new Date(u.created_at) >= weekStart)
            .map((u) => u.id);
        const activated = newIds.length
            ? await adminRepository.findCreatorIdsSince(weekStart, newIds)
            : new Set();

        return {
            days,
            signups: {
                last7d: sum(thisWeek, 'signups'),
                prev7d: sum(lastWeek, 'signups'),
            },
            waitlist: {
                last7d: sum(thisWeek, 'waitlist'),
                prev7d: sum(lastWeek, 'waitlist'),
            },
            activation: { new_users: newIds.length, activated: activated.size },
            active_users_7d: active.size,
            billing: hosted
                ? {
                      trials_started_7d: trialsStarted,
                      trials_ending_7d: trialsEnding,
                      canceled_7d: canceled,
                      payment_failed_7d: failed,
                  }
                : null,
        };
    }

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
            Feedback,
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
            openFeedback,
            trends,
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
            Feedback.count({ where: { resolved_at: null } }),
            this.trends(),
        ]);

        return {
            users: { total: users, admins, verified, last24h: newUsers },
            content: { tasks, projects, notes },
            waitlist: { total: waitlist, last7d: waitlistWeek },
            feedback: { open: openFeedback },
            trends,
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

    // The blog is the instance's own, so only the superadmin runs it.
    async getBlog(requesterId) {
        await this.verifyAdmin(requesterId);
        const { blogService } = require('../blog');
        return blogService.status();
    }

    async updateBlog(requesterId, body = {}) {
        await this.verifyAdmin(requesterId);
        const { blogService } = require('../blog');
        await blogService.setNoteUid(requesterId, body.note);
        return blogService.status();
    }
}

module.exports = new AdminService();
