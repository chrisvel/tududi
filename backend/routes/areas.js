const express = require('express');
const Area = require('../models-mongo/area');
const router = express.Router();

// GET /api/areas
router.get('/areas', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const areas = await Area.find({ user: req.session.userId }).sort({ name: 'asc' });

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

        const area = await Area.findOne({ _id: req.params.id, user: req.session.userId });

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

        const area = new Area({
            name: name.trim(),
            description: description || '',
            user: req.session.userId,
        });

        await area.save();

        res.status(201).json(area);
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(400).json({
            error: 'There was a problem creating the area.',
            details: error.message,
        });
    }
});

// PATCH /api/areas/:id
router.patch('/areas/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const area = await Area.findOne({ _id: req.params.id, user: req.session.userId });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        const { name, description } = req.body;

        if (name !== undefined) area.name = name;
        if (description !== undefined) area.description = description;

        await area.save();
        res.json(area);
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(400).json({
            error: 'There was a problem updating the area.',
            details: error.message,
        });
    }
});

// DELETE /api/areas/:id
router.delete('/areas/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const area = await Area.findOneAndDelete({ _id: req.params.id, user: req.session.userId });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(400).json({
            error: 'There was a problem deleting the area.',
        });
    }
});

module.exports = router;
