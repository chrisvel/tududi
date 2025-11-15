const express = require('express');
const { Note, Tag, Project } = require('../models');
const { extractUidFromSlug, isValidUid } = require('../utils/slug-utils');
const { validateTagName } = require('../services/tagsService');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});
const permissionsService = require('../services/permissionsService');
const { hasAccess } = require('../middleware/authorize');
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

router.get('/notes', async (req, res) => {
    try {
        const orderBy = req.query.order_by || 'title:asc';
        const [orderColumn, orderDirection] = orderBy.split(':');

        const whereClause = await permissionsService.ownershipOrPermissionWhere(
            'note',
            req.authUserId
        );
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

router.get(
    '/note/:uidSlug',
    hasAccess(
        'ro',
        'note',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uidSlug);
            // Check if note exists - return null if it doesn't (triggers 404)
            const note = await Note.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return note ? note.uid : null;
        },
        { notFoundMessage: 'Note not found.' }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: extractUidFromSlug(req.params.uidSlug) },
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

            res.json(note);
        } catch (error) {
            logError('Error fetching note:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.post('/note', async (req, res) => {
    try {
        const { title, content, project_uid, project_id, tags, color } =
            req.body;

        const noteAttributes = {
            title,
            content,
            user_id: req.authUserId,
        };

        // Add color if provided
        if (color !== undefined) {
            noteAttributes.color = color;
        }

        // Support both project_uid (new) and project_id (legacy)
        const projectIdentifier = project_uid || project_id;

        // If project identifier is provided, validate access and assign
        if (
            projectIdentifier &&
            !_.isEmpty(projectIdentifier.toString().trim())
        ) {
            let project;

            // Try to find by UID first (new way), then by ID (legacy)
            if (project_uid) {
                const projectUidValue = project_uid.toString().trim();
                project = await Project.findOne({
                    where: { uid: projectUidValue },
                });
            } else {
                // Legacy: find by numeric ID
                project = await Project.findByPk(project_id);
            }

            if (!project) {
                return res
                    .status(404)
                    .json({ error: 'Note project not found' });
            }

            // Check if user has write access to the project
            const projectAccess = await permissionsService.getAccess(
                req.authUserId,
                'project',
                project.uid
            );
            const isOwner = project.user_id === req.authUserId;
            const canWrite =
                isOwner || projectAccess === 'rw' || projectAccess === 'admin';

            if (!canWrite) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            noteAttributes.project_id = project.id;
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

        await updateNoteTags(note, tagNames, req.authUserId);

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

router.patch(
    '/note/:uid',
    hasAccess(
        'rw',
        'note',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uid);
            // Check if note exists - return null if it doesn't (triggers 404)
            const note = await Note.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return note ? note.uid : null;
        },
        { notFoundMessage: 'Note not found.' }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: req.params.uid },
            });

            const { title, content, project_uid, project_id, tags, color } =
                req.body;

            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (content !== undefined) updateData.content = content;
            if (color !== undefined) updateData.color = color;

            // Handle project assignment - support both project_uid (new) and project_id (legacy)
            const projectIdentifier =
                project_uid !== undefined ? project_uid : project_id;

            if (projectIdentifier !== undefined) {
                if (projectIdentifier && projectIdentifier.toString().trim()) {
                    let project;

                    // Try to find by UID first (new way), then by ID (legacy)
                    if (
                        project_uid !== undefined &&
                        typeof project_uid === 'string'
                    ) {
                        const projectUidValue = project_uid.trim();
                        project = await Project.findOne({
                            where: { uid: projectUidValue },
                        });
                    } else if (project_id !== undefined) {
                        // Legacy: find by numeric ID
                        project = await Project.findByPk(project_id);
                    }

                    if (!project) {
                        return res
                            .status(400)
                            .json({ error: 'Invalid project.' });
                    }
                    const projectAccess = await permissionsService.getAccess(
                        req.authUserId,
                        'project',
                        project.uid
                    );
                    const isOwner = project.user_id === req.authUserId;
                    const canWrite =
                        isOwner ||
                        projectAccess === 'rw' ||
                        projectAccess === 'admin';
                    if (!canWrite) {
                        return res.status(403).json({ error: 'Forbidden' });
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
                    } else if (
                        tags.every((t) => typeof t === 'object' && t.name)
                    ) {
                        tagNames = tags.map((t) => t.name);
                    }
                }
                await updateNoteTags(note, tagNames, req.authUserId);
            }

            // Reload note with associations
            const noteWithAssociations = await Note.findByPk(note.id, {
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                    },
                    {
                        model: Project,
                        required: false,
                        attributes: ['id', 'name', 'uid'],
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
    }
);

router.delete(
    '/note/:uid',
    hasAccess(
        'rw',
        'note',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uid);
            // Check if note exists - return null if it doesn't (triggers 404)
            const note = await Note.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return note ? note.uid : null;
        },
        { notFoundMessage: 'Note not found.' }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: req.params.uid },
            });

            await note.destroy();
            res.json({ message: 'Note deleted successfully.' });
        } catch (error) {
            logError('Error deleting note:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
