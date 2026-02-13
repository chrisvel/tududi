'use strict';

const notificationsService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        throw new UnauthorizedError('Authentication required');
    }
    return userId;
}

const notificationsController = {
    async getAll(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.getAll(userId, req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async getUnreadCount(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.getUnreadCount(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async markAsRead(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.markAsRead(
                userId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async markAsUnread(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.markAsUnread(
                userId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async markAllAsRead(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.markAllAsRead(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async dismiss(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.dismiss(
                userId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async getVapidKey(req, res, next) {
        try {
            const result = await notificationsService.getVapidKey();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async subscribe(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.subscribe(
                userId,
                req.body.subscription
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async unsubscribe(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.unsubscribe(
                userId,
                req.body.endpoint
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async triggerTest(req, res, next) {
        try {
            const userId = requireUserId(req);
            const result = await notificationsService.triggerTest(
                userId,
                req.body.type
            );
            res.json(result);
        } catch (error) {
            // Handle ValidationError with availableTypes
            if (error.availableTypes) {
                return res.status(error.statusCode || 400).json({
                    error: error.message,
                    availableTypes: error.availableTypes,
                });
            }
            next(error);
        }
    },

    async getTestTypes(req, res, next) {
        try {
            const result = await notificationsService.getTestTypes();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = notificationsController;
