const express = require('express');
const { Area } = require('../models');
const { isValidUid } = require('../utils/slug-utils');
const { logError } = require('../services/logService');
const _ = require('lodash');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

router.get('/areas', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        const areas = await Area.findAll({
            where: { user_id: userId },
            attributes: ['id', 'uid', 'name', 'description'],
            order: [['name', 'ASC']],
        });

        res.json(areas);
    } catch (error) {
        logError('Error fetching areas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/areas/:uid', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });
        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: userId },
            attributes: ['uid', 'name', 'description'],
        });

        if (_.isEmpty(area)) {
            return res.status(404).json({
                error: "Area not found or doesn't belong to the current user.",
            });
        }

        res.json(area);
    } catch (error) {
        logError('Error fetching area:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/areas', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        const { name, description } = req.body;

        if (!name || _.isEmpty(name.trim())) {
            return res.status(400).json({ error: 'Area name is required.' });
        }

        const area = await Area.create({
            name: name.trim(),
            description: description || '',
            user_id: userId,
        });

        res.status(201).json(_.pick(area, ['uid', 'name', 'description']));
    } catch (error) {
        logError('Error creating area:', error);
        res.status(400).json({
            error: 'There was a problem creating the area.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.patch('/areas/:uid', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });
        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: userId },
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
        logError('Error updating area:', error);
        res.status(400).json({
            error: 'There was a problem updating the area.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.delete('/areas/:uid', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const area = await Area.findOne({
            where: { uid: req.params.uid, user_id: userId },
        });

        if (!area) {
            return res.status(404).json({ error: 'Area not found.' });
        }

        await area.destroy();
        return res.status(204).send();
    } catch (error) {
        logError('Error deleting area:', error);
        res.status(400).json({
            error: 'There was a problem deleting the area.',
        });
    }
});

module.exports = router;
