'use strict';

const { User, Role } = require('../../models');
const { eraseUserAccount } = require('../../services/accountErasureService');

class AdminRepository {
    /**
     * Find all users with basic attributes.
     */
    async findAllUsers(userIds = null) {
        return User.findAll({
            where: userIds ? { id: userIds } : {},
            attributes: [
                'id',
                'email',
                'name',
                'surname',
                'created_at',
                'password_digest',
                'email_verified',
                'account_id',
            ],
        });
    }

    // Items each user created, per kind, plus when they last created one.
    // Recurring instances, system tags and self-people are made by the app,
    // not the user, so none of them count.
    async countItemsByUser() {
        const models = require('../../models');
        const { Op, fn, col } = require('sequelize');
        const kinds = [
            ['tasks', 'Task', { habit_mode: false, recurring_parent_id: null }],
            ['habits', 'Task', { habit_mode: true, recurring_parent_id: null }],
            ['projects', 'Project', {}],
            ['notes', 'Note', {}],
            ['areas', 'Area', {}],
            ['goals', 'Goal', {}],
            ['tags', 'Tag', { tag_type: { [Op.ne]: 'system' } }],
            [
                'people',
                'Person',
                {
                    [Op.or]: [
                        { linked_user_id: null },
                        {
                            linked_user_id: {
                                [Op.ne]: col('Person.user_id'),
                            },
                        },
                    ],
                },
            ],
            ['views', 'View', {}],
            ['inbox', 'InboxItem', {}],
        ];

        const results = await Promise.all(
            kinds.map(([, modelName, where]) =>
                models[modelName].findAll({
                    attributes: [
                        'user_id',
                        [fn('COUNT', col('id')), 'count'],
                        [fn('MAX', col('created_at')), 'last'],
                    ],
                    where,
                    group: ['user_id'],
                    raw: true,
                })
            )
        );

        const byUser = new Map();
        kinds.forEach(([kind], i) => {
            for (const row of results[i]) {
                if (!byUser.has(row.user_id)) {
                    byUser.set(row.user_id, { counts: {}, last: null });
                }
                const entry = byUser.get(row.user_id);
                entry.counts[kind] = Number(row.count);
                const last = row.last ? new Date(row.last) : null;
                if (last && (!entry.last || last > entry.last)) {
                    entry.last = last;
                }
            }
        });
        return byUser;
    }

    // Users who created a task, project, note, area or inbox item since
    // `since`, optionally only among `userIds`. Signup seeds none of these,
    // so a row means the person did something. Recurring instances are
    // made by the scheduler and do not count.
    async findCreatorIdsSince(since, userIds = null) {
        const models = require('../../models');
        const { Op } = require('sequelize');
        const kinds = [
            ['Task', { recurring_parent_id: null }],
            ['Project', {}],
            ['Note', {}],
            ['Area', {}],
            ['InboxItem', {}],
        ];
        const scope = userIds ? { user_id: userIds } : {};
        const results = await Promise.all(
            kinds.map(([modelName, where]) =>
                models[modelName].findAll({
                    attributes: ['user_id'],
                    where: {
                        ...where,
                        ...scope,
                        created_at: { [Op.gte]: since },
                    },
                    group: ['user_id'],
                    raw: true,
                })
            )
        );
        return new Set(results.flat().map((row) => row.user_id));
    }

    async findAccountOwnerIds(accountIds = null) {
        const { Account } = require('../../models');
        const rows = await Account.findAll({
            where: accountIds ? { id: accountIds } : {},
            attributes: ['owner_user_id'],
            raw: true,
        });
        return new Set(rows.map((row) => row.owner_user_id));
    }

    async findIdentityUserIds(userIds) {
        const { OIDCIdentity } = require('../../models');
        const rows = await OIDCIdentity.findAll({
            attributes: ['user_id'],
            where: userIds ? { user_id: userIds } : {},
            raw: true,
        });
        return new Set(rows.map((row) => row.user_id));
    }

    /**
     * Find all roles.
     */
    async findAllRoles(userIds = null) {
        return Role.findAll({
            where: userIds ? { user_id: userIds } : {},
            attributes: ['user_id', 'is_admin', 'role', 'capabilities'],
        });
    }

    /**
     * Find user by ID.
     */
    async findUserById(id, options = {}) {
        return User.findByPk(id, options);
    }

    /**
     * Find user by ID with UID attribute only.
     */
    async findUserUidById(id) {
        return User.findByPk(id, { attributes: ['uid'] });
    }

    /**
     * Create a user.
     */
    async createUser(userData) {
        return User.create(userData);
    }

    /**
     * Find or create a role.
     */
    async findOrCreateRole(userId, isAdmin) {
        return Role.findOrCreate({
            where: { user_id: userId },
            defaults: { user_id: userId, is_admin: isAdmin },
        });
    }

    /**
     * Find role by user ID.
     */
    async findRoleByUserId(userId, options = {}) {
        return Role.findOne({ where: { user_id: userId }, ...options });
    }

    /**
     * Count roles.
     */
    async countRoles() {
        return Role.count();
    }

    /**
     * Count admin roles.
     */
    async countAdminRoles(options = {}) {
        return Role.count({ where: { is_admin: true }, ...options });
    }

    /**
     * Delete a user and all associated data in a transaction.
     */
    async deleteUserWithData(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            return { success: false, error: 'User not found', status: 404 };
        }

        // Prevent deleting the last remaining admin
        const targetRole = await Role.findOne({ where: { user_id: userId } });
        if (targetRole?.is_admin) {
            const adminCount = await Role.count({ where: { is_admin: true } });
            if (adminCount <= 1) {
                return {
                    success: false,
                    error: 'Cannot delete the last remaining admin',
                    status: 400,
                };
            }
        }

        await eraseUserAccount(userId);
        return { success: true };
    }
}

module.exports = new AdminRepository();
