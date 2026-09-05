'use strict';

const express = require('express');
const controller = require('./controller');
const entitlements = require('../../services/entitlementsService');

// Mounted in app.js before the JSON body parser, sessions, CSRF and the
// rate limiters: Stripe needs the raw bytes to verify its signature and has
// no session. 404 on self-hosted instances.
function webhookHandler() {
    const raw = express.raw({ type: '*/*', limit: '1mb' });
    return (req, res, next) => {
        if (!entitlements.isHostedMode()) {
            return res.status(404).json({ error: 'Not found' });
        }
        raw(req, res, (err) => {
            if (err) return next(err);
            controller.webhook(req, res);
        });
    };
}

module.exports = { webhookHandler };
