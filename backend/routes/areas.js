const express = require('express');
const { Area } = require('../models');
const router = express.Router();

// GET /api/areas
router.get('/areas', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const areas = await Area.findAll({
            where: { user_id: req.session.userId },
            order: [['name', 'ASC']],
        });

        res.json(areas);
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/areas/:id
router.get('/areas/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const area = await Area.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!area) {
            return res.status(404).json({
                error: "Area not found or doesn't belong to the current user.",
            });
        }

        res.json(area);
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/areas
router.post('/areas', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Area name is required.' });
        }

        const area = await Area.create({
            name: name.trim(),
            description: description || '',
            user_id: req.session.userId,
        });

        res.status(201).json(area);
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(400).json({
            error: 'There was a problem creating the area.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// PATCH /api/areas/:id
router.patch('/areas/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const area = await Area.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        const { name, description } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        await area.update(updateData);
        res.json(area);
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(400).json({
            error: 'There was a problem updating the area.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/areas/:id
router.delete('/areas/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const area = await Area.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        await area.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(400).json({
            error: 'There was a problem deleting the area.',
        });
    }
});

module.exports = router;
