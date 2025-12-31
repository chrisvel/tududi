'use strict';

const quotesService = require('./quotesService');

const quotesController = {
    async getRandom(req, res, next) {
        try {
            const quote = quotesService.getRandomQuote();
            res.json({ quote });
        } catch (error) {
            next(error);
        }
    },

    async getAll(req, res, next) {
        try {
            const quotes = quotesService.getAllQuotes();
            res.json({
                quotes,
                count: quotesService.getQuotesCount(),
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = quotesController;
