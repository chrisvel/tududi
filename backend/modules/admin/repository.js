'use strict';

const {
    User,
    Role,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    Action,
    Permission,
    View,
    ApiToken,
    Notification,
    RecurringCompletion,
    sequelize,
} = require('../../models');

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
    async deleteUserWithData(userId, requesterId) {
        const transaction = await sequelize.transaction();

        try {
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                await transaction.rollback();
                return { success: false, error: 'User not found', status: 404 };
            }

            // Prevent deleting the last remaining admin
            const targetRole = await Role.findOne({
                where: { user_id: userId },
                transaction,
            });
            if (targetRole?.is_admin) {
                const adminCount = await Role.count({
                    where: { is_admin: true },
                    transaction,
                });
                if (adminCount <= 1) {
                    await transaction.rollback();
                    return {
                        success: false,
                        error: 'Cannot delete the last remaining admin',
                        status: 400,
                    };
                }
            }

            // Delete all associated data
            await TaskEvent.destroy({
                where: { user_id: userId },
                transaction,
            });

            const userTasks = await Task.findAll({
                where: { user_id: userId },
                attributes: ['id'],
                transaction,
            });
            const taskIds = userTasks.map((t) => t.id);
            if (taskIds.length > 0) {
                await RecurringCompletion.destroy({
                    where: { task_id: taskIds },
                    transaction,
                });
            }

            await Task.destroy({ where: { user_id: userId }, transaction });
            await Note.destroy({ where: { user_id: userId }, transaction });
            await Project.destroy({ where: { user_id: userId }, transaction });
            await Area.destroy({ where: { user_id: userId }, transaction });
            await Tag.destroy({ where: { user_id: userId }, transaction });
            await InboxItem.destroy({
                where: { user_id: userId },
                transaction,
            });
            await View.destroy({ where: { user_id: userId }, transaction });
            await Notification.destroy({
                where: { user_id: userId },
                transaction,
            });
            await ApiToken.destroy({ where: { user_id: userId }, transaction });
            await Permission.destroy({
                where: { user_id: userId },
                transaction,
            });
            await Permission.destroy({
                where: { granted_by_user_id: userId },
                transaction,
            });
            await Action.destroy({
                where: { actor_user_id: userId },
                transaction,
            });
            await Action.destroy({
                where: { target_user_id: userId },
                transaction,
            });
            await Role.destroy({ where: { user_id: userId }, transaction });
            await user.destroy({ transaction });

            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = new AdminRepository();
