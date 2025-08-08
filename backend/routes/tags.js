const express = require('express');
const { Tag, Task, Note, Project, sequelize } = require('../models');
const { extractUidFromSlug } = require('../utils/slug-utils');
const { validateTagName } = require('../utils/validation');
const router = express.Router();
const _ = require('lodash');

// GET /api/tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await Tag.findAll({
            where: { user_id: req.currentUser.id },
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
        });
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/tag (with query parameters: id, uid, or name)
router.get('/tag', async (req, res) => {
    try {
        let whereClause = { user_id: req.currentUser.id };

        if (req.query.id) {
            whereClause.id = parseInt(req.query.id);
        } else if (req.query.uid) {
            whereClause.uid = req.query.uid;
        } else if (req.query.name) {
            whereClause.name = req.query.name;
        } else {
            return res.status(400).json({
                error: 'Missing required query parameter: id, uid, or name',
            });
        }

        const tag = await Tag.findOne({
            where: whereClause,
            attributes: ['id', 'uid', 'name'],
        });

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.json(tag);
    } catch (error) {
        console.error('Error fetching tag:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/tag/:identifier (supports both ID and name)
router.get('/tag/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let whereClause;

        // Check if identifier is a number (ID) or string (name)
        if (/^\d+$/.test(identifier)) {
            // It's a numeric ID
            whereClause = {
                id: parseInt(identifier),
                user_id: req.currentUser.id,
            };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne({
            where: whereClause,
            attributes: ['id', 'name'],
        });

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.json(tag);
    } catch (error) {
        console.error('Error fetching tag:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/tag
router.post('/tag', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        const tag = await Tag.create({
            name: name.trim(),
            user_id: req.currentUser.id,
        });

        res.status(201).json({
            id: tag.id,
            name: tag.name,
        });
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(400).json({
            error: 'There was a problem creating the tag.',
        });
    }
});

// PATCH /api/tag/:identifier (supports both ID and name)
router.patch('/tag/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let whereClause;

        // Check if identifier is a number (ID) or string (name)
        if (/^\d+$/.test(identifier)) {
            // It's a numeric ID
            whereClause = {
                id: parseInt(identifier),
                user_id: req.currentUser.id,
            };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne({
            where: whereClause,
        });

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        await tag.update({ name: name.trim() });

        res.json({
            id: tag.id,
            name: tag.name,
        });
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(400).json({
            error: 'There was a problem updating the tag.',
        });
    }
});

// DELETE /api/tag/:identifier (supports both ID and name)
router.delete('/tag/:identifier', async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const identifier = req.params.identifier;
        let whereClause;

        // Check if identifier is a number (ID) or string (name)
        if (/^\d+$/.test(identifier)) {
            // It's a numeric ID
            whereClause = {
                id: parseInt(identifier),
                user_id: req.currentUser.id,
            };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne({
            where: whereClause,
        });

        if (!tag) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Use transaction to ensure all deletions happen atomically
        // Remove all associations before deleting the tag by manually deleting from junction tables
        // Only delete from tables that exist
        try {
            await sequelize.query('DELETE FROM tasks_tags WHERE tag_id = ?', {
                replacements: [tag.id],
                type: sequelize.QueryTypes.DELETE,
                transaction,
            });
        } catch (error) {
            // Ignore if table doesn't exist
            console.log('tasks_tags table not found, skipping');
        }

        try {
            await sequelize.query('DELETE FROM notes_tags WHERE tag_id = ?', {
                replacements: [tag.id],
                type: sequelize.QueryTypes.DELETE,
                transaction,
            });
        } catch (error) {
            // Ignore if table doesn't exist
            console.log('notes_tags table not found, skipping');
        }

        try {
            await sequelize.query(
                'DELETE FROM projects_tags WHERE tag_id = ?',
                {
                    replacements: [tag.id],
                    type: sequelize.QueryTypes.DELETE,
                    transaction,
                }
            );
        } catch (error) {
            // Ignore if table doesn't exist
            console.log('projects_tags table not found, skipping');
        }

        // Now safely delete the tag
        await tag.destroy({ transaction });

        await transaction.commit();
        res.json({ message: 'Tag successfully deleted' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting tag:', error);
        res.status(400).json({
            error: 'There was a problem deleting the tag.',
        });
    }
});

module.exports = router;
