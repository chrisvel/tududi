const express = require('express');
const router = express.Router();
const { Role, User } = require('../models');
const { isAdmin } = require('../services/rolesService');
const { logError } = require('../services/logService');

// POST /api/admin/set-admin-role
// Body: { user_id: number, is_admin: boolean }
router.post('/admin/set-admin-role', async (req, res) => {
    try {
        const requesterId = req.currentUser?.id || req.session?.userId;
        if (!requesterId)
            return res.status(401).json({ error: 'Authentication required' });

        // Fetch user to get uid for isAdmin check
        const requester = await User.findByPk(requesterId, {
            attributes: ['uid'],
        });
        if (!requester)
            return res.status(401).json({ error: 'Authentication required' });

        // Allow if requester is already admin OR if there are no roles yet (bootstrap)
        const requesterIsAdmin = await isAdmin(requester.uid);
        const existingRolesCount = await Role.count();
        if (!requesterIsAdmin && existingRolesCount > 0) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { user_id, is_admin } = req.body;
        if (!user_id || typeof is_admin !== 'boolean') {
            return res
                .status(400)
                .json({ error: 'user_id and is_admin are required' });
        }

        const user = await User.findByPk(user_id);
        if (!user) return res.status(400).json({ error: 'Invalid user_id' });

        const [role] = await Role.findOrCreate({
            where: { user_id },
            defaults: { user_id, is_admin },
        });
        if (role.is_admin !== is_admin) {
            role.is_admin = is_admin;
            await role.save();
        }
        res.json({ user_id, is_admin: role.is_admin });
    } catch (err) {
        logError('Error setting admin role:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

// --- Admin Users Management ---
// NOTE: app.js already mounts this router under requireAuth

// Middleware to ensure admin access
async function requireAdmin(req, res, next) {
    try {
        const requesterId = req.currentUser?.id || req.session?.userId;
        if (!requesterId)
            return res.status(401).json({ error: 'Authentication required' });

        // Fetch user to get uid for isAdmin check
        const user = await User.findByPk(requesterId, { attributes: ['uid'] });
        if (!user)
            return res.status(401).json({ error: 'Authentication required' });

        const admin = await isAdmin(user.uid);
        if (!admin) return res.status(403).json({ error: 'Forbidden' });
        next();
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/users - list users with role and creation date
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'name', 'surname', 'created_at'],
        });
        // Fetch roles in bulk
        const roles = await Role.findAll({
            attributes: ['user_id', 'is_admin'],
        });
        const userIdToRole = new Map(roles.map((r) => [r.user_id, r.is_admin]));
        const result = users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            role: userIdToRole.get(u.id) ? 'admin' : 'user',
        }));
        res.json(result);
    } catch (err) {
        logError('Error listing users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/users - create a user (default role: user)
router.post('/admin/users', requireAdmin, async (req, res) => {
    try {
        const { email, password, name, surname, role } = req.body || {};
        if (!email || !password) {
            return res
                .status(400)
                .json({ error: 'Email and password are required' });
        }
        // Very basic validation consistent with login rules
        if (typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (typeof password !== 'string' || password.length < 6) {
            return res
                .status(400)
                .json({ error: 'Password must be at least 6 characters' });
        }
        // Create user; model hook will hash password
        const userData = { email, password };
        if (name) userData.name = name;
        if (surname) userData.surname = surname;
        const user = await User.create(userData);
        // Optionally assign admin role if requested and allowed
        const makeAdmin = role === 'admin';
        if (makeAdmin) {
            // Find or create role, and ensure is_admin is true
            const [userRole, roleCreated] = await Role.findOrCreate({
                where: { user_id: user.id },
                defaults: { user_id: user.id, is_admin: true },
            });

            // Update to admin if role exists but is not admin
            if (!roleCreated && !userRole.is_admin) {
                userRole.is_admin = true;
                await userRole.save();
            }
        }
        res.status(201).json({
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role: makeAdmin ? 'admin' : 'user',
        });
    } catch (err) {
        logError('Error creating user:', err);
        // Unique constraint
        if (err?.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(400).json({
            error: 'There was a problem creating the user.',
        });
    }
});

// PUT /api/admin/users/:id - update a user
router.put('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid user id' });

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { email, password, name, surname, role } = req.body || {};

        // Update email if provided
        if (email !== undefined && email !== null) {
            if (typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            user.email = email;
        }

        // Update password if provided
        if (password && password.trim() !== '') {
            if (typeof password !== 'string' || password.length < 6) {
                return res
                    .status(400)
                    .json({ error: 'Password must be at least 6 characters' });
            }
            user.password = password;
        }

        // Update name and surname - handle empty strings properly
        if (name !== undefined) user.name = name || null;
        if (surname !== undefined) user.surname = surname || null;

        await user.save();

        // Update role if provided
        if (role !== undefined) {
            const makeAdmin = role === 'admin';
            const [userRole] = await Role.findOrCreate({
                where: { user_id: user.id },
                defaults: { user_id: user.id, is_admin: makeAdmin },
            });
            if (userRole.is_admin !== makeAdmin) {
                userRole.is_admin = makeAdmin;
                await userRole.save();
            }
        }

        // Fetch updated role
        const userRole = await Role.findOne({ where: { user_id: user.id } });

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role: userRole?.is_admin ? 'admin' : 'user',
        });
    } catch (err) {
        logError('Error updating user:', err);
        // Unique constraint
        if (err?.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(400).json({
            error: 'There was a problem updating the user.',
        });
    }
});

// DELETE /api/admin/users/:id - delete a user, prevent self-delete
router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const requesterId = req.currentUser?.id || req.session?.userId;
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid user id' });
        if (id === requesterId)
            return res
                .status(400)
                .json({ error: 'Cannot delete your own account' });

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Prevent deleting the last remaining admin
        const targetRole = await Role.findOne({ where: { user_id: id } });
        if (targetRole?.is_admin) {
            const adminCount = await Role.count({ where: { is_admin: true } });
            if (adminCount <= 1) {
                return res
                    .status(400)
                    .json({ error: 'Cannot delete the last remaining admin' });
            }
        }

        await user.destroy();
        res.status(204).send();
    } catch (err) {
        logError('Error deleting user:', err);
        res.status(400).json({
            error: 'There was a problem deleting the user.',
        });
    }
});

// POST /api/admin/toggle-registration - toggle registration setting
router.post('/admin/toggle-registration', requireAdmin, async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res
                .status(400)
                .json({ error: 'enabled must be a boolean value' });
        }

        const {
            setRegistrationEnabled,
        } = require('../services/registrationService');
        await setRegistrationEnabled(enabled);

        res.json({ enabled });
    } catch (err) {
        logError('Error toggling registration:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
