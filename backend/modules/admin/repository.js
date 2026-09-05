'use strict';

const { User, Role } = require('../../models');
const { eraseUserAccount } = require('../../services/accountErasureService');

class AdminRepository {
    /**
     * Find all users with basic attributes.
     */
    async findAllUsers() {
        return User.findAll({
            attributes: ['id', 'email', 'name', 'surname', 'created_at'],
        });
    }

    /**
     * Find all roles.
     */
    async findAllRoles() {
        return Role.findAll({
            attributes: ['user_id', 'is_admin'],
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
