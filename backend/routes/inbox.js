const express = require('express');
const { InboxItem } = require('../models');
const { processInboxItem } = require('../services/inboxProcessingService');
const router = express.Router();

// GET /api/inbox
router.get('/inbox', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if pagination parameters are provided
        const hasPagination =
            req.query.limit !== undefined || req.query.offset !== undefined;

        if (hasPagination) {
            // Parse pagination parameters
            const limit = parseInt(req.query.limit) || 20; // Default to 20 items
            const offset = parseInt(req.query.offset) || 0;

            // Get total count for pagination info
            const totalCount = await InboxItem.count({
                where: {
                    user_id: req.session.userId,
                    status: 'added',
                },
            });

            const items = await InboxItem.findAll({
                where: {
                    user_id: req.session.userId,
                    status: 'added',
                },
                order: [['created_at', 'DESC']],
                limit: limit,
                offset: offset,
            });

            res.json({
                items: items,
                pagination: {
                    total: totalCount,
                    limit: limit,
                    offset: offset,
                    hasMore: offset + items.length < totalCount,
                },
            });
        } else {
            // Return simple array for backward compatibility (used by tests)
            const items = await InboxItem.findAll({
                where: {
                    user_id: req.session.userId,
                    status: 'added',
                },
                order: [['created_at', 'DESC']],
            });

            res.json(items);
        }
    } catch (error) {
        console.error('Error fetching inbox items:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/inbox
router.post('/inbox', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { content, source } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Ensure source is never null/undefined
        const finalSource = source && source.trim() ? source.trim() : 'manual';

        const item = await InboxItem.create({
            content: content.trim(),
            source: finalSource,
            user_id: req.session.userId,
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating inbox item:', error);
        res.status(400).json({
            error: 'There was a problem creating the inbox item.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// GET /api/inbox/:id
router.get('/inbox/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const item = await InboxItem.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!item) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        res.json(item);
    } catch (error) {
        console.error('Error fetching inbox item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/inbox/:id
router.patch('/inbox/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const item = await InboxItem.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!item) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        const { content, status } = req.body;
        const updateData = {};

        if (content !== undefined) updateData.content = content;
        if (status !== undefined) updateData.status = status;

        await item.update(updateData);
        res.json(item);
    } catch (error) {
        console.error('Error updating inbox item:', error);
        res.status(400).json({
            error: 'There was a problem updating the inbox item.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/inbox/:id
router.delete('/inbox/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const item = await InboxItem.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!item) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        // Mark as deleted instead of actual deletion
        await item.update({ status: 'deleted' });
        res.json({ message: 'Inbox item successfully deleted' });
    } catch (error) {
        console.error('Error deleting inbox item:', error);
        res.status(400).json({
            error: 'There was a problem deleting the inbox item.',
        });
    }
});

// PATCH /api/inbox/:id/process
router.patch('/inbox/:id/process', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const item = await InboxItem.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!item) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        await item.update({ status: 'processed' });
        res.json(item);
    } catch (error) {
        console.error('Error processing inbox item:', error);
        res.status(400).json({
            error: 'There was a problem processing the inbox item.',
        });
    }
});

// POST /api/inbox/analyze-text
router.post('/inbox/analyze-text', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { content } = req.body;

        if (!content || typeof content !== 'string') {
            return res
                .status(400)
                .json({ error: 'Content is required and must be a string' });
        }

        // Process the text using the inbox processing service
        const result = processInboxItem(content);

        res.json(result);
    } catch (error) {
        console.error('Error analyzing inbox text:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
