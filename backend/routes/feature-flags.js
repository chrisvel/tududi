const express = require('express');
const router = express.Router();

router.get('/feature-flags', (req, res) => {
    try {
        const featureFlags = {
            backups: process.env.FF_ENABLE_BACKUPS === 'true',
            calendar: process.env.FF_ENABLE_CALENDAR === 'true',
            habits: process.env.FF_ENABLE_HABITS === 'true',
        };

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
