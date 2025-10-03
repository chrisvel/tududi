const express = require('express');
const { Note, Tag, Project, sequelize } = require('../models');
const { Op } = require('sequelize');
const { extractUidFromSlug, isValidUid } = require('../utils/slug-utils');
const { validateTagName } = require('../services/tagsService');
const router = express.Router();
const _ = require('lodash');
const { logError } = require('../services/logService');

// Helper function to update note tags
async function updateNoteTags(note, tagsArray, userId) {
    if (_.isEmpty(tagsArray)) {
        await note.setTags([]);
        return;
    }

    try {
        // Validate and filter tag names
        const validTagNames = [];
        const invalidTags = [];

        for (const name of tagsArray) {
            const validation = validateTagName(name);
            if (validation.valid) {
                // Check for duplicates
                if (!validTagNames.includes(validation.name)) {
                    validTagNames.push(validation.name);
                }
            } else {
                invalidTags.push({ name, error: validation.error });
            }
        }

        if (invalidTags.length > 0) {
            throw new Error(
                `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
            );
        }

        const tags = await Promise.all(
            validTagNames.map(async (name) => {
                const [tag] = await Tag.findOrCreate({
                    where: { name, user_id: userId },
                    defaults: { name, user_id: userId },
                });
                return tag;
            })
        );
        await note.setTags(tags);
    } catch (error) {
        logError('Failed to update tags:', error.message);
        throw error; // Re-throw to handle at route level
    }
}

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Get all notes for the authenticated user
 *     parameters:
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *         description: Order by field and direction (e.g., title:asc)
 *     responses:
 *       200:
 *         description: List of notes
 */
router.get('/notes', async (req, res) => {
    try {
        const orderBy = req.query.order_by || 'title:asc';
        const [orderColumn, orderDirection] = orderBy.split(':');

        let whereClause = { user_id: req.session.userId };
        let includeClause = [
            {
                model: Tag,
                attributes: ['name', 'uid'],
                through: { attributes: [] },
            },
            {
                model: Project,
                required: false,
                attributes: ['name', 'uid'],
            },
        ];

        // Filter by tag
        if (req.query.tag) {
            includeClause[0].where = { name: req.query.tag };
            includeClause[0].required = true;
        }

        const notes = await Note.findAll({
            where: whereClause,
            include: includeClause,
            order: [[orderColumn, orderDirection.toUpperCase()]],
            distinct: true,
        });

        res.json(notes);
    } catch (error) {
        logError('Error fetching notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/note/:uidSlug
router.get('/note/:uidSlug', async (req, res) => {
    try {
        const uid = extractUidFromSlug(req.params.uidSlug);
        if (_.isEmpty(uid)) {
            return res.status(400).json({ error: 'Invalid note identifier' });
        }

        const note = await Note.findOne({
            where: { uid, user_id: req.session.userId },
            include: [
                {
                    model: Tag,
                    attributes: ['name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    required: false,
                    attributes: ['name', 'uid'],
                },
            ],
        });

        if (_.isEmpty(note)) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        res.json(note);
    } catch (error) {
        logError('Error fetching note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /note:
 *   post:
 *     summary: Create a new note
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               project_uid:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Note created
 */
router.post('/note', async (req, res) => {
    try {
        const { title, content, project_uid, tags } = req.body;

        const noteAttributes = {
            title,
            content,
            user_id: req.session.userId,
        };

        // Handle project assignment
        if (project_uid !== undefined) {
            const projectUid = project_uid.toString().trim();
            if (!_.isEmpty(projectUid)) {
                const project = await Project.findOne({
                    where: { uid: projectUid, user_id: req.session.userId },
                });
                if (_.isEmpty(project)) {
                    return res.status(400).json({ error: 'Invalid project.' });
                }
                noteAttributes.project_id = project.id;
            }
        }

        const note = await Note.create(noteAttributes);

        // Handle tags - can be an array of strings
        // or array of objects with name property
        let tagNames = [];
        if (Array.isArray(tags)) {
            if (tags.every((t) => typeof t === 'string')) {
                tagNames = tags;
            } else if (tags.every((t) => typeof t === 'object' && t.name)) {
                tagNames = tags.map((t) => t.name);
            }
        }

        await updateNoteTags(note, tagNames, req.session.userId);

        // Reload note with associations
        const noteWithAssociations = await Note.findByPk(note.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    required: false,
                    attributes: ['name', 'uid'],
                },
            ],
        });

        res.status(201).json({
            ...noteWithAssociations.toJSON(),
            uid: noteWithAssociations.uid,
        });
    } catch (error) {
        logError('Error creating note:', error);
        res.status(400).json({
            error: 'There was a problem creating the note.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

/**
 * @swagger
 * /note/{uid}:
 *   patch:
 *     summary: Update a note
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
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               project_uid:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Note updated
 */
router.patch('/note/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const note = await Note.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        const { title, content, project_uid, tags } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;

        // Handle project assignment
        if (project_uid !== undefined) {
            const projectUid = project_uid.toString().trim();
            if (!_.isEmpty(projectUid)) {
                const project = await Project.findOne({
                    where: { uid: projectUid, user_id: req.session.userId },
                });
                if (!project) {
                    return res.status(400).json({ error: 'Invalid project.' });
                }
                updateData.project_id = project.id;
            } else {
                updateData.project_id = null;
            }
        }

        await note.update(updateData);

        // Handle tags if provided
        if (tags !== undefined) {
            let tagNames = [];
            if (Array.isArray(tags)) {
                if (tags.every((t) => typeof t === 'string')) {
                    tagNames = tags;
                } else if (tags.every((t) => typeof t === 'object' && t.name)) {
                    tagNames = tags.map((t) => t.name);
                }
            }
            await updateNoteTags(note, tagNames, req.session.userId);
        }

        // Reload note with associations
        const noteWithAssociations = await Note.findByPk(note.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    required: false,
                    attributes: ['name', 'uid'],
                },
            ],
        });

        res.json(noteWithAssociations);
    } catch (error) {
        logError('Error updating note:', error);
        res.status(400).json({
            error: 'There was a problem updating the note.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/note/:uid
router.delete('/note/:uid', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const note = await Note.findOne({
            where: { uid: req.params.uid, user_id: req.session.userId },
        });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        await note.destroy();
        res.json({ message: 'Note deleted successfully.' });
    } catch (error) {
        logError('Error deleting note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
