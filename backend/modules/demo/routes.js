'use strict';

const express = require('express');
const router = express.Router();
const demoService = require('./service');
const { authLimiter } = require('../../middleware/rateLimiter');
const { logError } = require('../../services/logService');

// Opening the sandbox is a public action: no password to publish, no form
// to fill in. It signs the caller into the shared demo account and nothing
// else. Rate limited like the other unauthenticated auth routes.
//
// 404 when the demo is switched off, so a self-hosted instance shows no
// trace of it.
router.get('/demo/status', async (req, res) => {
    const status = await demoService.demoStatus();
    if (!status.available) return res.status(404).json({ error: 'Not found' });
    res.json(status);
});

router.post('/demo/login', authLimiter, async (req, res) => {
    try {
        if (!demoService.isDemoEnabled()) {
            return res.status(404).json({ error: 'Not found' });
        }
        const user = await demoService.ensureDemoUser();
        if (!user) return res.status(503).json({ error: 'Demo unavailable' });

        req.session.userId = user.id;
        res.json({
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (error) {
        logError('Demo login failed:', error);
        res.status(500).json({ error: 'Could not open the demo' });
    }
});

module.exports = router;
