'use strict';

const billingService = require('./service');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError, ValidationError } = require('../../shared/errors');
const providers = require('./providers');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const billingController = {
    async status(req, res, next) {
        try {
            res.json(await billingService.getStatus(requireUserId(req)));
        } catch (error) {
            next(error);
        }
    },

    catalog(req, res, next) {
        try {
            res.json(billingService.getCatalog());
        } catch (error) {
            next(error);
        }
    },

    async checkout(req, res, next) {
        try {
            const interval = req.body?.interval === 'year' ? 'year' : 'month';
            res.json(
                await billingService.createCheckoutSession(
                    requireUserId(req),
                    interval
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async portal(req, res, next) {
        try {
            res.json(
                await billingService.createPortalSession(requireUserId(req))
            );
        } catch (error) {
            next(error);
        }
    },

    async sync(req, res, next) {
        try {
            const sessionId = req.body?.session_id;
            if (sessionId !== undefined && typeof sessionId !== 'string') {
                throw new ValidationError('session_id must be a string');
            }
            res.json(
                await billingService.syncFromProvider(requireUserId(req), {
                    checkoutRef: sessionId,
                })
            );
        } catch (error) {
            next(error);
        }
    },

    // Raw body, no session, no CSRF: the provider signs the payload instead.
    async webhook(req, res) {
        const provider = providers.getProvider();
        if (!req.headers[provider.signatureHeader]) {
            return res.status(400).json({ error: 'Missing webhook signature' });
        }
        try {
            const result = await billingService.handleWebhook(
                req.body,
                req.headers
            );
            res.json({ received: true, ...result });
        } catch (error) {
            if (error.name === 'WebhookSignatureError') {
                return res
                    .status(400)
                    .json({ error: 'Invalid webhook signature' });
            }
            if (error.statusCode === 503) {
                return res.status(503).json({ error: error.message });
            }
            logError('Billing webhook failed:', error);
            // 500 makes the provider retry, which is what we want for our own faults
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    },

    async adminList(req, res, next) {
        try {
            res.json(
                await billingService.adminListAccounts(
                    requireUserId(req),
                    req.query
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async adminGet(req, res, next) {
        try {
            res.json(
                await billingService.adminGetAccount(
                    requireUserId(req),
                    Number(req.params.userId)
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async adminSetOverride(req, res, next) {
        try {
            res.json(
                await billingService.adminSetOverride(
                    requireUserId(req),
                    Number(req.params.userId),
                    req.body || {}
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async adminClearOverride(req, res, next) {
        try {
            res.json(
                await billingService.adminClearOverride(
                    requireUserId(req),
                    Number(req.params.userId)
                )
            );
        } catch (error) {
            next(error);
        }
    },

    async adminSync(req, res, next) {
        try {
            res.json(
                await billingService.adminSync(
                    requireUserId(req),
                    Number(req.params.userId)
                )
            );
        } catch (error) {
            next(error);
        }
    },
};

module.exports = billingController;
