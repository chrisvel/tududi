const express = require('express');
const { Area } = require('../models');
const { isValidUid } = require('../utils/slug-utils');
const _ = require('lodash');
const router = express.Router();

/**
 * @swagger
 * /areas:
 *   get:
 *     summary: Get all areas for the authenticated user
 *     responses:
 *       200:
 *         description: List of areas
 */
router.get('/areas', async (req, res) => {
    try {
        const areas = await Area.findAll({
            where: { user_id: req.session.userId },
            attributes: ['uid', 'name', 'description'],
            order: [['name', 'ASC']],
        });

        res.json(areas);
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/areas/:uid
router.get('/areas/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });
        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
            attributes: ['uid', 'name', 'description'],
        });

        if (_.isEmpty(area)) {
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

/**
 * @swagger
 * /areas:
 *   post:
 *     summary: Create a new area
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Area created
 */
router.post('/areas', async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || _.isEmpty(name.trim())) {
            return res.status(400).json({ error: 'Area name is required.' });
        }

        const area = await Area.create({
            name: name.trim(),
            description: description || '',
            user_id: req.session.userId,
        });

        res.status(201).json(_.pick(area, ['uid', 'name', 'description']));
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

/**
 * @swagger
 * /areas/{uid}:
 *   patch:
 *     summary: Update an area
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Area updated
 */
router.patch('/areas/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });
        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        const { name, description } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        await area.update(updateData);
        res.json(_.pick(area, ['uid', 'name', 'description']));
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

// DELETE /api/areas/:uid
router.delete('/areas/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        await area.destroy();
        return res.status(204).send();
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(400).json({
            error: 'There was a problem deleting the area.',
        });
    }
});

module.exports = router;
