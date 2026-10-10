'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getConfig } = require('../../config/config');
const { createRateLimitStore } = require('../../middleware/rateLimitStore');
const { UnauthorizedError } = require('../../shared/errors');
const service = require('./service');
const { keep } = require('./seed');
const { SAMPLES } = require('./samples');

// Two routers: the public one (status and parse) is mounted before
// requireAuth so a stranger can use it; keep needs a signed-in account.
//
// 404 when switched off, like the demo sandbox, so a self-hosted instance
// shows no trace of it.

function buildParseLimiter() {
    const { rateLimiting } = getConfig();
    return rateLimit({
        store: createRateLimitStore('untangle'),
        windowMs: rateLimiting.untangle.windowMs,
        max: rateLimiting.untangle.max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => !rateLimiting.enabled,
        keyGenerator: (req) => ipKeyGenerator(req.ip),
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many tries',
                message:
                    'You have untangled a lot in the last hour. Sign up to keep going, or try again later.',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
            });
        },
    });
}

const publicRoutes = express.Router();

publicRoutes.get('/untangle/status', async (req, res, next) => {
    try {
        if (!(await service.isUntangleEnabled())) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json({
            available: true,
            samples: SAMPLES.map(({ key, label, text }) => ({
                key,
                label,
                text,
            })),
        });
    } catch (err) {
        next(err);
    }
});

// Samples are open to anyone; a person's own list is behind sign-in
publicRoutes.post(
    '/untangle/sample',
    async (req, res, next) => {
        try {
            if (!(await service.isUntangleEnabled())) {
                return res.status(404).json({ error: 'Not found' });
            }
            next();
        } catch (err) {
            next(err);
        }
    },
    buildParseLimiter(),
    async (req, res, next) => {
        try {
            res.json(await service.untangleSample(req.body || {}));
        } catch (err) {
            next(err);
        }
    }
);

const routes = express.Router();

routes.post('/untangle/parse', async (req, res, next) => {
    try {
        if (!req.currentUser) {
            throw new UnauthorizedError('Authentication required');
        }
        res.json(await service.untangleOwn(req.currentUser, req.body || {}));
    } catch (err) {
        next(err);
    }
});

routes.post('/untangle/keep', async (req, res, next) => {
    try {
        if (!req.currentUser) {
            throw new UnauthorizedError('Authentication required');
        }
        res.json(await keep(req.currentUser, req.body || {}));
    } catch (err) {
        next(err);
    }
});

module.exports = { publicRoutes, routes };
