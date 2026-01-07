'use strict';

const urlService = require('./service');
const { logError } = require('../../services/logService');

const urlController = {
    async getTitle(req, res, next) {
        try {
            const { url } = req.query;

            if (!url) {
                return res
                    .status(400)
                    .json({ error: 'URL parameter is required' });
            }

            const result = await urlService.getTitle(url);
            res.json(result);
        } catch (error) {
            logError('Error extracting URL title:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async extractFromText(req, res, next) {
        try {
            const { text } = req.body;

            if (!text) {
                return res
                    .status(400)
                    .json({ error: 'Text parameter is required' });
            }

            const result = await urlService.extractFromText(text);
            res.json(result);
        } catch (error) {
            logError('Error extracting URL from text:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
};

module.exports = urlController;
