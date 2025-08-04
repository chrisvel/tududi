const express = require('express');
const { Tag, Task, Note, Project, sequelize } = require('../models');
const { extractNanoidFromSlug } = require('../utils/slug-utils');
const router = express.Router();

// Helper function to validate tag name
function validateTagName(name) {
    if (!name || !name.trim()) {
        return { valid: false, error: 'Tag name is required' };
    }

    const trimmedName = name.trim();

    // Check for invalid characters that can break URLs or cause issues
    const invalidChars = /[#%&{}\\<>*?/$!'":@+`|=]/;
    if (invalidChars.test(trimmedName)) {
        return {
            valid: false,
            error: 'Tag name contains invalid characters. Please avoid: # % & { } \\ < > * ? / $ ! \' " : @ + ` | =',
        };
    }

    // Check length limits
    if (trimmedName.length > 50) {
        return {
            valid: false,
            error: 'Tag name must be 50 characters or less',
        };
    }

    if (trimmedName.length < 1) {
        return { valid: false, error: 'Tag name cannot be empty' };
    }

    return { valid: true, name: trimmedName };
}

// GET /api/tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await Tag.findAll({
            where: { user_id: req.currentUser.id },
            attributes: ['id', 'name', 'nanoid'],
            order: [['name', 'ASC']],
        });
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/tag/:identifier (supports both ID, name, and nanoid-slug)
router.get('/tag/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let whereClause;

        // Check if identifier is numeric (ID), nanoid-slug, or tag name
        if (/^\d+$/.test(identifier)) {
            // It's a numeric ID
            whereClause = {
                id: parseInt(identifier),
                user_id: req.currentUser.id,
            };
        } else if (identifier.includes('-') && identifier.length > 21) {
            // It's likely a nanoid-slug, extract the nanoid
            const nanoid = extractNanoidFromSlug(identifier);
            if (!nanoid) {
                return res
                    .status(400)
                    .json({ error: 'Invalid tag identifier' });
            }
            whereClause = { nanoid: nanoid, user_id: req.currentUser.id };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne({
            where: whereClause,
            attributes: ['id', 'name', 'nanoid'],
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

        const validation = validateTagName(name);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const tag = await Tag.create({
            name: validation.name,
            user_id: req.currentUser.id,
        });

        res.status(201).json({
            id: tag.id,
            nanoid: tag.nanoid, // Explicitly include nanoid
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

        const validation = validateTagName(name);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        await tag.update({ name: validation.name });

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
