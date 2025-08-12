const express = require('express');
const { User, Permission } = require('../models');
const { execAction } = require('../services/execAction');
const router = express.Router();

// POST /api/shares
router.post('/shares', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { resource_type, resource_uid, target_user_email, access_level } = req.body;
    if (!resource_type || !resource_uid || !target_user_email || !access_level) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    const target = await User.findOne({ where: { email: target_user_email } });
    if (!target) return res.status(404).json({ error: 'Target user not found' });

    await execAction({
      verb: 'share_grant',
      actorUserId: req.session.userId,
      targetUserId: target.id,
      resourceType: resource_type,
      resourceUid: resource_uid,
      accessLevel: access_level,
    });
    res.status(204).end();
  } catch (err) {
    console.error('Error sharing resource:', err);
    res.status(400).json({ error: 'Unable to share resource' });
  }
});

// DELETE /api/shares
router.delete('/shares', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { resource_type, resource_uid, target_user_id } = req.body;
    if (!resource_type || !resource_uid || !target_user_id) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    await execAction({
      verb: 'share_revoke',
      actorUserId: req.session.userId,
      targetUserId: Number(target_user_id),
      resourceType: resource_type,
      resourceUid: resource_uid,
    });
    res.status(204).end();
  } catch (err) {
    console.error('Error revoking share:', err);
    res.status(400).json({ error: 'Unable to revoke share' });
  }
});

// GET /api/shares?resource_type=...&resource_uid=...
router.get('/shares', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { resource_type, resource_uid } = req.query;
    if (!resource_type || !resource_uid) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const rows = await Permission.findAll({
      where: { resource_type, resource_uid, propagation: 'direct' },
      attributes: ['user_id', 'access_level', 'created_at'],
      raw: true,
    });
    res.json({ shares: rows });
  } catch (err) {
    console.error('Error listing shares:', err);
    res.status(400).json({ error: 'Unable to list shares' });
  }
});

module.exports = router;
