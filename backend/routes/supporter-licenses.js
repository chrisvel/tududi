const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { logError } = require('../services/logService');
const supporterLicenseService = require('../services/supporterLicenseService');
const { getAuthenticatedUserId } = require('../utils/request-utils');
const { isAdmin } = require('../services/rolesService');
const { User, SupporterLicense } = require('../models');

/**
 * GET /api/profile/supporter
 * Get current user's supporter license status
 */
router.get('/profile/supporter', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const license = await supporterLicenseService.getUserLicense(userId);

        if (!license) {
            return res.json({
                has_license: false,
                tier: null,
                status: null,
            });
        }

        res.json({
            has_license: true,
            ...license,
        });
    } catch (error) {
        logError('Error fetching supporter license:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/profile/supporter/activate
 * Activate a license key for the current user
 */
router.post('/profile/supporter/activate', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const { license_key } = req.body;

        if (!license_key) {
            return res.status(400).json({ error: 'License key is required' });
        }

        const result = await supporterLicenseService.activateLicense(
            userId,
            license_key
        );

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        logError('Error activating supporter license:', error);

        if (
            error.message === 'License key not found' ||
            error.message === 'Invalid license key format'
        ) {
            return res.status(404).json({ error: error.message });
        }

        if (
            error.message === 'This license key is already in use' ||
            error.message === 'License already activated for this user'
        ) {
            return res.status(409).json({ error: error.message });
        }

        if (error.message === 'This license key has been revoked') {
            return res.status(403).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/supporters
 * Get list of all supporters (admin only)
 */
router.get('/admin/supporters', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const userIsAdmin = await isAdmin(userId);

        if (!userIsAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const supporters = await supporterLicenseService.getAllSupporters();

        res.json({
            supporters,
            total: supporters.length,
        });
    } catch (error) {
        logError('Error fetching supporters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/supporters/analytics
 * Get supporter analytics (admin only)
 */
router.get('/admin/supporters/analytics', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const userIsAdmin = await isAdmin(userId);

        if (!userIsAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const analytics = await supporterLicenseService.getAdminAnalytics();

        res.json(analytics);
    } catch (error) {
        logError('Error fetching supporter analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/supporters/:id
 * Revoke a supporter license (admin only)
 */
router.delete('/admin/supporters/:id', requireAuth, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const userIsAdmin = await isAdmin(userId);

        if (!userIsAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const licenseId = parseInt(req.params.id, 10);

        if (isNaN(licenseId)) {
            return res.status(400).json({ error: 'Invalid license ID' });
        }

        await supporterLicenseService.revokeLicense(licenseId);

        res.json({
            success: true,
            message: 'License revoked successfully',
        });
    } catch (error) {
        logError('Error revoking supporter license:', error);

        if (error.message === 'License not found') {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
