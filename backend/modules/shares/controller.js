'use strict';

const sharesService = require('./service');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const sharesController = {
    async create(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            await sharesService.createShare(userId, req.body);
            res.status(204).end();
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 403) {
                return res.status(403).json({ error: error.message });
            }
            if (error.statusCode === 404) {
                return res.status(404).json({ error: error.message });
            }
            logError('Error sharing resource:', error);
            res.status(400).json({ error: 'Unable to share resource' });
        }
    },

    async delete(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            await sharesService.deleteShare(userId, req.body);
            res.status(204).end();
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 403) {
                return res.status(403).json({ error: error.message });
            }
            logError('Error revoking share:', error);
            res.status(400).json({ error: 'Unable to revoke share' });
        }
    },

    async getAll(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const { resource_type, resource_uid } = req.query;
            const result = await sharesService.getShares(
                userId,
                resource_type,
                resource_uid
            );
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 403) {
                return res.status(403).json({ error: error.message });
            }
            logError('Error listing shares:', error);
            res.status(400).json({ error: 'Unable to list shares' });
        }
    },
};

module.exports = sharesController;
