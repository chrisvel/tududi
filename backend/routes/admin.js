const express = require('express');
const router = express.Router();
const { Role, User } = require('../models');
const { isAdmin } = require('../services/rolesService');

// POST /api/admin/set-admin-role
// Body: { user_id: number, is_admin: boolean }
router.post('/admin/set-admin-role', async (req, res) => {
  try {
    const requesterId = req.currentUser?.id || req.session?.userId;
    if (!requesterId) return res.status(401).json({ error: 'Authentication required' });

    // Allow if requester is already admin OR if there are no roles yet (bootstrap)
    const requesterIsAdmin = await isAdmin(requesterId);
    const existingRolesCount = await Role.count();
    if (!requesterIsAdmin && existingRolesCount > 0) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { user_id, is_admin } = req.body;
    if (!user_id || typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'user_id and is_admin are required' });
    }

    const user = await User.findByPk(user_id);
    if (!user) return res.status(400).json({ error: 'Invalid user_id' });

    const [role] = await Role.findOrCreate({ where: { user_id }, defaults: { user_id, is_admin } });
    if (role.is_admin !== is_admin) {
      role.is_admin = is_admin;
      await role.save();
    }
    res.json({ user_id, is_admin: role.is_admin });
  } catch (err) {
    console.error('Error setting admin role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
