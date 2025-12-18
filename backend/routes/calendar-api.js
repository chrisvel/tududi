/**
 * iCal Calendar API Routes (Protected - Session/Bearer auth)
 *
 * These routes manage iCal feed tokens and require standard authentication.
 * They are registered AFTER requireAuth middleware in app.js.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { User } = require('../models');

/**
 * Generate a secure random token for iCal feed
 * Format: ical_xxxxx (32 random hex characters)
 */
function generateIcalToken() {
    return 'ical_' + crypto.randomBytes(16).toString('hex');
}

/**
 * POST /api/calendar/generate-token
 *
 * Generates a new iCal feed token for the authenticated user.
 * Requires standard session/Bearer token authentication.
 * If user already has a token, this regenerates it (invalidating the old one).
 */
router.post('/calendar/generate-token', async (req, res) => {
    try {
        if (!req.currentUser) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }

        const user = await User.findByPk(req.currentUser.id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
            });
        }

        // Generate new token
        const newToken = generateIcalToken();

        // Update user with new token and enable feed
        await user.update({
            ical_feed_token: newToken,
            ical_feed_enabled: true,
        });

        // Build the feed URL
        const protocol = req.protocol;
        const host = req.get('host');
        const feedUrl = `${protocol}://${host}/api/calendar/feed.ics?token=${newToken}`;

        res.json({
            success: true,
            message: 'Calendar feed token generated successfully',
            ical_feed_token: newToken,
            feed_url: feedUrl,
        });
    } catch (error) {
        console.error('Error generating iCal token:', error);
        res.status(500).json({
            error: 'Internal server error',
        });
    }
});

/**
 * DELETE /api/calendar/token
 *
 * Revokes the iCal feed token and disables the feed.
 * Requires standard session/Bearer token authentication.
 */
router.delete('/calendar/token', async (req, res) => {
    try {
        if (!req.currentUser) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }

        const user = await User.findByPk(req.currentUser.id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
            });
        }

        // Clear token and disable feed
        await user.update({
            ical_feed_token: null,
            ical_feed_enabled: false,
        });

        res.json({
            success: true,
            message: 'Calendar feed disabled and token revoked',
        });
    } catch (error) {
        console.error('Error revoking iCal token:', error);
        res.status(500).json({
            error: 'Internal server error',
        });
    }
});

/**
 * GET /api/calendar/feed-url
 *
 * Returns the subscription URL for the authenticated user.
 * Requires standard session/Bearer token authentication.
 */
router.get('/calendar/feed-url', async (req, res) => {
    try {
        if (!req.currentUser) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }

        const user = await User.findByPk(req.currentUser.id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
            });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        if (!user.ical_feed_token || !user.ical_feed_enabled) {
            return res.json({
                enabled: false,
                hasToken: false,
                message:
                    'iCal feed is not enabled. Enable it in Calendar settings to get your feed URL.',
            });
        }

        res.json({
            enabled: true,
            hasToken: true,
            feed_url: `${baseUrl}/api/calendar/feed.ics?token=${user.ical_feed_token}`,
            parameters: {
                completed: 'Set to "true" to include completed tasks',
                project: 'Filter by project ID',
            },
        });
    } catch (error) {
        console.error('Error getting feed URL:', error);
        res.status(500).json({
            error: 'Internal server error',
        });
    }
});

module.exports = router;
