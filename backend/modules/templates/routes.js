'use strict';

const express = require('express');
const router = express.Router();
const templatesService = require('./service');
const { requireAuth } = require('../../middleware/auth');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');

function getUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

function requireTemplatesEnabled(req, res, next) {
    const config = getConfig();
    if (!config.templatesEnabled) {
        return res.status(404).json({ error: 'Templates feature is not enabled' });
    }
    next();
}

function handleError(res, next, err) {
    next(err);
}

// GET /templates - list user's templates
router.get('/templates', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const result = await templatesService.getAll(userId);
        res.json(result);
    } catch (err) {
        handleError(res, next, err);
    }
});

// GET /template/:uid - get template with full structure
router.get('/template/:uid', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const template = await templatesService.getByUid(
            req.params.uid,
            userId
        );
        res.json(template);
    } catch (err) {
        handleError(res, next, err);
    }
});

// POST /template - create template from scratch
router.post('/template', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const template = await templatesService.create(userId, req.body);
        res.status(201).json(template);
    } catch (err) {
        handleError(res, next, err);
    }
});

// POST /project/:uid/save-as-template - copy existing project as template
router.post(
    '/project/:uid/save-as-template',
    requireAuth,
    requireTemplatesEnabled,
    async (req, res, next) => {
        try {
            const userId = getUserId(req);
            const template = await templatesService.saveProjectAsTemplate(
                req.params.uid,
                userId,
                req.body
            );
            res.status(201).json(template);
        } catch (err) {
            handleError(res, next, err);
        }
    }
);

// POST /template/:uid/clone - clone template into a new project
router.post('/template/:uid/clone', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const project = await templatesService.cloneTemplate(
            req.params.uid,
            userId,
            req.body
        );
        res.status(201).json(project);
    } catch (err) {
        handleError(res, next, err);
    }
});

// PATCH /template/:uid - update template metadata
router.patch('/template/:uid', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const template = await templatesService.update(
            req.params.uid,
            userId,
            req.body
        );
        res.json(template);
    } catch (err) {
        handleError(res, next, err);
    }
});

// DELETE /template/:uid - delete template
router.delete('/template/:uid', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const result = await templatesService.delete(req.params.uid, userId);
        res.json(result);
    } catch (err) {
        handleError(res, next, err);
    }
});

// GET /marketplace/templates - browse marketplace templates
router.get('/marketplace/templates', requireAuth, requireTemplatesEnabled, async (req, res, next) => {
    try {
        const result = await templatesService.fetchMarketplaceTemplates(
            req.query
        );
        res.json(result);
    } catch (err) {
        handleError(res, next, err);
    }
});

// GET /marketplace/templates/:uid - get single marketplace template
router.get(
    '/marketplace/templates/:uid',
    requireAuth,
    requireTemplatesEnabled,
    async (req, res, next) => {
        try {
            const template = await templatesService.fetchMarketplaceTemplate(
                req.params.uid
            );
            res.json(template);
        } catch (err) {
            handleError(res, next, err);
        }
    }
);

// POST /marketplace/templates/:uid/install - download and install marketplace template
router.post(
    '/marketplace/templates/:uid/install',
    requireAuth,
    requireTemplatesEnabled,
    async (req, res, next) => {
        try {
            const userId = getUserId(req);
            const template = await templatesService.installMarketplaceTemplate(
                req.params.uid,
                userId
            );
            res.status(201).json(template);
        } catch (err) {
            handleError(res, next, err);
        }
    }
);

module.exports = router;
