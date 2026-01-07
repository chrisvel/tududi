'use strict';

const backupService = require('./service');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const backupController = {
    async export(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.exportData(userId);
            res.json(result);
        } catch (error) {
            logError('Error exporting user data:', error);
            res.status(500).json({
                error: 'Failed to export data',
                message: error.message,
            });
        }
    },

    async import(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.importData(
                userId,
                req.file,
                req.body
            );
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                const response = { error: error.message };
                if (error.errors) {
                    response.errors = error.errors;
                }
                if (error.versionMessage) {
                    response.message = error.versionMessage;
                    response.backupVersion = error.backupVersion;
                }
                return res.status(400).json(response);
            }
            logError('Error importing user data:', error);
            res.status(500).json({
                error: 'Failed to import data',
                message: error.message,
            });
        }
    },

    async validate(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.validateBackup(userId, req.file);
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                const response = { valid: false };
                if (error.parseMessage) {
                    response.error = 'Invalid backup file';
                    response.message = error.parseMessage;
                } else if (error.errors) {
                    response.errors = error.errors;
                } else if (error.versionIncompatible) {
                    response.versionIncompatible = true;
                    response.message = error.versionMessage;
                    response.backupVersion = error.backupVersion;
                }
                return res.status(400).json(response);
            }
            logError('Error validating backup file:', error);
            res.status(500).json({
                valid: false,
                error: 'Failed to validate backup file',
                message: error.message,
            });
        }
    },

    async list(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.listBackups(userId);
            res.json(result);
        } catch (error) {
            logError('Error listing backups:', error);
            res.status(500).json({
                error: 'Failed to list backups',
                message: error.message,
            });
        }
    },

    async download(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.downloadBackup(
                userId,
                req.params.uid
            );

            res.setHeader('Content-Type', result.contentType);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${result.filename}"`
            );
            res.setHeader('Content-Length', result.fileBuffer.length);

            res.send(result.fileBuffer);
        } catch (error) {
            if (error.statusCode === 404) {
                return res.status(404).json({ error: error.message });
            }
            logError('Error downloading backup:', error);
            res.status(500).json({
                error: 'Failed to download backup',
                message: error.message,
            });
        }
    },

    async restore(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const result = await backupService.restoreBackup(
                userId,
                req.params.uid,
                req.body
            );
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({
                    error: 'Version incompatible',
                    message: error.versionMessage,
                    backupVersion: error.backupVersion,
                });
            }
            logError('Error restoring backup:', error);
            res.status(500).json({
                error: 'Failed to restore backup',
                message: error.message,
            });
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

            const result = await backupService.deleteBackup(
                userId,
                req.params.uid
            );
            res.json(result);
        } catch (error) {
            logError('Error deleting backup:', error);
            res.status(500).json({
                error: 'Failed to delete backup',
                message: error.message,
            });
        }
    },
};

module.exports = backupController;
