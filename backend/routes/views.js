const express = require('express');
const { View } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('../services/logService');
const router = express.Router();

// GET /api/views - Get all views for the current user
router.get('/', async (req, res) => {
    try {
        const views = await View.findAll({
            where: { user_id: req.currentUser.id },
            order: [
                ['is_pinned', 'DESC'],
                ['created_at', 'DESC'],
            ],
        });
        res.json(views);
    } catch (error) {
        logError('Error fetching views:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/views/pinned - Get pinned views for the current user
router.get('/pinned', async (req, res) => {
    try {
        const views = await View.findAll({
            where: {
                user_id: req.currentUser.id,
                is_pinned: true,
            },
            order: [['created_at', 'DESC']],
        });
        res.json(views);
    } catch (error) {
        logError('Error fetching pinned views:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/views/:identifier - Get a specific view by uid
router.get('/:identifier', async (req, res) => {
    try {
        const identifier = decodeURIComponent(req.params.identifier);

        const view = await View.findOne({
            where: {
                uid: identifier,
                user_id: req.currentUser.id,
            },
        });

        if (!view) {
            return res.status(404).json({ error: 'View not found' });
        }

        res.json(view);
    } catch (error) {
        logError('Error fetching view:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/views - Create a new view
router.post('/', async (req, res) => {
    try {
        const { name, search_query, filters, priority, due, tags, recurring } =
            req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'View name is required' });
        }

        const view = await View.create({
            name: name.trim(),
            user_id: req.currentUser.id,
            search_query: search_query || null,
            filters: filters || [],
            priority: priority || null,
            due: due || null,
            tags: tags || [],
            recurring: recurring || null,
            is_pinned: false,
        });

        res.status(201).json(view);
    } catch (error) {
        logError('Error creating view:', error);
        res.status(400).json({
            error: 'There was a problem creating the view.',
        });
    }
});

// PATCH /api/views/:identifier - Update a view
router.patch('/:identifier', async (req, res) => {
    try {
        const identifier = decodeURIComponent(req.params.identifier);

        const view = await View.findOne({
            where: {
                uid: identifier,
                user_id: req.currentUser.id,
            },
        });

        if (!view) {
            return res.status(404).json({ error: 'View not found' });
        }

        const {
            name,
            search_query,
            filters,
            priority,
            due,
            tags,
            recurring,
            is_pinned,
        } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (search_query !== undefined) updates.search_query = search_query;
        if (filters !== undefined) updates.filters = filters;
        if (priority !== undefined) updates.priority = priority;
        if (due !== undefined) updates.due = due;
        if (tags !== undefined) updates.tags = tags;
        if (recurring !== undefined) updates.recurring = recurring;
        if (is_pinned !== undefined) updates.is_pinned = is_pinned;

        await view.update(updates);

        res.json(view);
    } catch (error) {
        logError('Error updating view:', error);
        res.status(400).json({
            error: 'There was a problem updating the view.',
        });
    }
});

// DELETE /api/views/:identifier - Delete a view
router.delete('/:identifier', async (req, res) => {
    try {
        const identifier = decodeURIComponent(req.params.identifier);

        const view = await View.findOne({
            where: {
                uid: identifier,
                user_id: req.currentUser.id,
            },
        });

        if (!view) {
            return res.status(404).json({ error: 'View not found' });
        }

        await view.destroy();

        res.json({ message: 'View successfully deleted' });
    } catch (error) {
        logError('Error deleting view:', error);
        res.status(400).json({
            error: 'There was a problem deleting the view.',
        });
    }
});

module.exports = router;
