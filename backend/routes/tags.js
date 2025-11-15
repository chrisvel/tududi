const express = require('express');
const { Tag, Task, Note, Project, sequelize } = require('../models');
const { extractUidFromSlug } = require('../utils/slug-utils');
const { validateTagName } = require('../services/tagsService');
const router = express.Router();
const _ = require('lodash');
const { Op } = require('sequelize');
const { logError } = require('../services/logService');

router.get('/tags', async (req, res) => {
    try {
        const tags = await Tag.findAll({
            where: { user_id: req.currentUser.id },
            attributes: ['name', 'uid'],
            order: [['name', 'ASC']],
        });
        res.json(tags);
    } catch (error) {
        logError('Error fetching tags:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/tag/:identifier (supports name and uid)
router.get('/tag', async (req, res) => {
    try {
        const { uid, name } = req.query;

        let whereClause = {
            user_id: req.currentUser.id,
        };
        if (!_.isEmpty(uid)) {
            whereClause.uid = uid;
        }
        if (!_.isEmpty(name)) {
            whereClause.name = decodeURIComponent(name);
        }

        const tag = await Tag.findOne({
            where: whereClause,
            attributes: ['name', 'uid'],
        });

        if (_.isEmpty(tag)) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.json(tag);
    } catch (error) {
        logError('Error fetching tag:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/tag', async (req, res) => {
    try {
        const { name } = req.body;

        const validation = validateTagName(name);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Check if tag already exists for this user
        const existingTag = await Tag.findOne({
            where: {
                name: validation.name,
                user_id: req.currentUser.id,
            },
        });

        if (existingTag) {
            return res.status(409).json({
                error: `A tag with the name "${validation.name}" already exists.`,
            });
        }

        const tag = await Tag.create({
            name: validation.name,
            user_id: req.currentUser.id,
        });

        res.status(201).json({
            uid: tag.uid,
            name: tag.name,
        });
    } catch (error) {
        logError('Error creating tag:', error);
        // Check if it's a unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                error: 'A tag with this name already exists.',
            });
        }
        res.status(400).json({
            error: 'There was a problem creating the tag.',
        });
    }
});

// PATCH /api/tag/:identifier (supports both ID and name)
router.patch('/tag/:identifier', async (req, res) => {
    try {
        const param = decodeURIComponent(req.params.identifier);
        let whereClause = {
            [Op.or]: [
                { name: param, user_id: req.currentUser.id },
                { uid: param, user_id: req.currentUser.id },
            ],
        };

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

        // Check if another tag with the same name already exists
        if (validation.name !== tag.name) {
            const existingTag = await Tag.findOne({
                where: {
                    name: validation.name,
                    user_id: req.currentUser.id,
                    id: { [Op.ne]: tag.id },
                },
            });

            if (existingTag) {
                return res.status(409).json({
                    error: `A tag with the name "${validation.name}" already exists.`,
                });
            }
        }

        await tag.update({ name: validation.name });

        res.json({
            id: tag.id,
            name: tag.name,
        });
    } catch (error) {
        logError('Error updating tag:', error);
        // Check if it's a unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                error: 'A tag with this name already exists.',
            });
        }
        res.status(400).json({
            error: 'There was a problem updating the tag.',
        });
    }
});

// DELETE /api/tag/:identifier (supports uid and name)
router.delete('/tag/:identifier', async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const param = decodeURIComponent(req.params.identifier);
        let whereClause = {
            [Op.or]: [
                { name: param, user_id: req.currentUser.id },
                { uid: param, user_id: req.currentUser.id },
            ],
        };

        const tag = await Tag.findOne({
            where: whereClause,
        });

        if (_.isEmpty(tag)) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Remove all associations before deleting the tag by manually deleting from junction tables
        // Only delete from tables that exist
        await Promise.all([
            sequelize.query('DELETE FROM tasks_tags WHERE tag_id = ?', {
                replacements: [tag.id],
                type: sequelize.QueryTypes.DELETE,
                transaction,
            }),
            sequelize.query('DELETE FROM notes_tags WHERE tag_id = ?', {
                replacements: [tag.id],
                type: sequelize.QueryTypes.DELETE,
                transaction,
            }),
            sequelize.query('DELETE FROM projects_tags WHERE tag_id = ?', {
                replacements: [tag.id],
                type: sequelize.QueryTypes.DELETE,
                transaction,
            }),
        ]);

        await tag.destroy({ transaction });
        await transaction.commit();

        res.json({ message: 'Tag successfully deleted' });
    } catch (error) {
        await transaction.rollback();
        logError('Error deleting tag:', error);
        res.status(400).json({
            error: 'There was a problem deleting the tag.',
        });
    }
});

module.exports = router;
