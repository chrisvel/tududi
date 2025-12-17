const express = require('express');
const router = express.Router();
const { User } = require('../models');

/**
 * GET /api/feature-flags
 *
 * Returns feature flags for the application.
 *
 * For the calendar feature, we use a hybrid approach:
 * - If user is logged in: Use their calendar_enabled preference
 * - If user is not logged in: Fall back to FF_ENABLE_CALENDAR env var
 *
 * Other feature flags (backups, habits) use environment variables.
 */
router.get('/feature-flags', async (req, res) => {
    try {
        // Default feature flags from environment variables
        const featureFlags = {
            backups: process.env.FF_ENABLE_BACKUPS === 'true',
            calendar: process.env.FF_ENABLE_CALENDAR === 'true',
            habits: process.env.FF_ENABLE_HABITS === 'true',
        };

        // If user is authenticated via session, use their calendar_enabled preference
        if (req.session && req.session.userId) {
            try {
                const user = await User.findByPk(req.session.userId);
                if (user) {
                    // User's calendar_enabled preference takes precedence
                    featureFlags.calendar = user.calendar_enabled === true;
                }
            } catch (userError) {
                // If we can't fetch user, fall back to env var
                console.error(
                    'Error fetching user for feature flags:',
                    userError
                );
            }
        }

        res.json({ featureFlags });
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({
            error: 'Failed to fetch feature flags',
            message: error.message,
        });
    }
});

module.exports = router;
