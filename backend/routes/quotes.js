const express = require('express');
const router = express.Router();
const { logError } = require('../services/logService');
const quotesService = require('../services/quotesService');

// GET /api/quotes/random - Get a random quote
router.get('/quotes/random', (req, res) => {
    try {
        const quote = quotesService.getRandomQuote();
        res.json({ quote });
    } catch (error) {
        logError('Error getting random quote:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/quotes - Get all quotes
router.get('/quotes', (req, res) => {
    try {
        const quotes = quotesService.getAllQuotes();
        res.json({
            quotes,
            count: quotesService.getQuotesCount(),
        });
    } catch (error) {
        logError('Error getting quotes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
