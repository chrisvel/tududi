'use strict';

const adminRepository = require('./repository');
const {
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
} = require('./validation');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
    UnauthorizedError,
    ConflictError,
} = require('../../shared/errors');
const { isAdmin } = require('../../services/rolesService');

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
        const existingRolesCount = await adminRepository.countRoles();

        if (!requesterIsAdmin && existingRolesCount > 0) {
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

        const [role] = await adminRepository.findOrCreateRole(
            user_id,
            makeAdmin
        );
        if (role.is_admin !== makeAdmin) {
            role.is_admin = makeAdmin;
            await role.save();
        }

        return { user_id, is_admin: role.is_admin };
    }

    /**
     * List all users with roles.
     */
    async listUsers(requesterId) {
        await this.verifyAdmin(requesterId);

        const users = await adminRepository.findAllUsers();
        const roles = await adminRepository.findAllRoles();
        const userIdToRole = new Map(roles.map((r) => [r.user_id, r.is_admin]));

        return users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            role: userIdToRole.get(u.id) ? 'admin' : 'user',
        }));
    }

    /**
     * Create a new user.
     */
    async createUser(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const { email, password, name, surname, role } =
            validateCreateUser(body);

        const userData = { email, password };
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

        const makeAdmin = role === 'admin';
        if (makeAdmin) {
            const [userRole, roleCreated] =
                await adminRepository.findOrCreateRole(user.id, true);
            if (!roleCreated && !userRole.is_admin) {
                userRole.is_admin = true;
                await userRole.save();
            }
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role: makeAdmin ? 'admin' : 'user',
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

        const { email, password, name, surname, role } = body || {};

        if (email !== undefined && email !== null) {
            validateEmail(email);
            user.email = email;
        }

        if (password && password.trim() !== '') {
            validatePassword(password);
            user.password = password;
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
            const makeAdmin = role === 'admin';
            const [userRole] = await adminRepository.findOrCreateRole(
                user.id,
                makeAdmin
            );
            if (userRole.is_admin !== makeAdmin) {
                userRole.is_admin = makeAdmin;
                await userRole.save();
            }
        }

        const userRole = await adminRepository.findRoleByUserId(user.id);

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role: userRole?.is_admin ? 'admin' : 'user',
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

        const result = await adminRepository.deleteUserWithData(
            id,
            requesterId
        );

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
    async toggleRegistration(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const { enabled } = validateToggleRegistration(body);

        const {
            setRegistrationEnabled,
        } = require('../auth/registrationService');
        await setRegistrationEnabled(enabled);

        return { enabled };
    }
}

module.exports = new AdminService();
