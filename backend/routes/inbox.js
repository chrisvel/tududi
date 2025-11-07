const express = require('express');
const { InboxItem } = require('../models');
const { processInboxItem } = require('../services/inboxProcessingService');
const { isValidUid } = require('../utils/slug-utils');
const _ = require('lodash');
const { logError } = require('../services/logService');
const router = express.Router();

/**
 * @swagger
 * /api/inbox:
 *   get:
 *     summary: Get inbox items
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of inbox items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InboxItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/inbox', async (req, res) => {
    try {
        // Check if pagination parameters are provided
        const hasPagination =
            !_.isEmpty(req.query.limit) || !_.isEmpty(req.query.offset);

        if (hasPagination) {
            // Parse pagination parameters
            const limit = parseInt(req.query.limit, 10) || 20; // Default to 20 items
            const offset = parseInt(req.query.offset, 10) || 0;

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
        logError('Error fetching inbox items:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/inbox:
 *   post:
 *     summary: Create a new inbox item
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Inbox item content
 *                 example: "Remember to call John"
 *               source:
 *                 type: string
 *                 description: Source of the item
 *                 example: "manual"
 *     responses:
 *       201:
 *         description: Inbox item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/inbox', async (req, res) => {
    try {
        const { content, source } = req.body;

        if (!content || _.isEmpty(content.trim())) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Ensure source is never null/undefined
        const finalSource = source && source.trim() ? source.trim() : 'manual';

        const item = await InboxItem.create({
            content: content.trim(),
            source: finalSource,
            user_id: req.session.userId,
        });

        res.status(201).json(
            _.pick(item, [
                'uid',
                'content',
                'status',
                'source',
                'created_at',
                'updated_at',
            ])
        );
    } catch (error) {
        logError('Error creating inbox item:', error);
        res.status(400).json({
            error: 'There was a problem creating the inbox item.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// GET /api/inbox/:uid
router.get('/inbox/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const item = await InboxItem.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
            attributes: [
                'uid',
                'content',
                'status',
                'source',
                'created_at',
                'updated_at',
            ],
        });

        if (_.isEmpty(item)) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        res.json(item);
    } catch (error) {
        logError('Error fetching inbox item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/inbox/:uid
router.patch('/inbox/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const item = await InboxItem.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (_.isEmpty(item)) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        const { content, status } = req.body;
        const updateData = {};

        if (content != null) updateData.content = content;
        if (status != null) updateData.status = status;

        await item.update(updateData);
        res.json(
            _.pick(item, [
                'uid',
                'content',
                'status',
                'source',
                'created_at',
                'updated_at',
            ])
        );
    } catch (error) {
        logError('Error updating inbox item:', error);
        res.status(400).json({
            error: 'There was a problem updating the inbox item.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/inbox/:uid
router.delete('/inbox/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const item = await InboxItem.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (_.isEmpty(item)) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        // Mark as deleted instead of actual deletion
        await item.update({ status: 'deleted' });
        res.json({ message: 'Inbox item successfully deleted' });
    } catch (error) {
        logError('Error deleting inbox item:', error);
        res.status(400).json({
            error: 'There was a problem deleting the inbox item.',
        });
    }
});

// PATCH /api/inbox/:uid/process
router.patch('/inbox/:uid/process', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const item = await InboxItem.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (_.isEmpty(item)) {
            return res.status(404).json({ error: 'Inbox item not found.' });
        }

        await item.update({ status: 'processed' });
        res.json(
            _.pick(item, [
                'uid',
                'content',
                'status',
                'source',
                'created_at',
                'updated_at',
            ])
        );
    } catch (error) {
        logError('Error processing inbox item:', error);
        res.status(400).json({
            error: 'There was a problem processing the inbox item.',
        });
    }
});

// POST /api/inbox/analyze-text
router.post('/inbox/analyze-text', async (req, res) => {
    try {
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
        logError('Error analyzing inbox text:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
