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
