const express = require('express');
const Note = require('../models/note');
const Tag = require('../models/tag');
const Project = require('../models/project');
const router = express.Router();

// Helper function to update note tags
async function updateNoteTags(note, tagsArray, userId) {
    try {
        if (!tagsArray || tagsArray.length === 0) {
            note.tags = [];
            await note.save();
            return;
        }

        const tagNames = tagsArray.filter(
            (name, index, arr) => arr.indexOf(name) === index
        ); // unique

        const tagIds = [];
        for (const name of tagNames) {
            const tag = await Tag.findOneAndUpdate(
                { name, user_id: userId },
                { name, user_id: userId },
                { upsert: true, new: true }
            );
            tagIds.push(tag._id);
        }
        note.tags = tagIds;
        await note.save();
    } catch (error) {
        console.error('Failed to update tags:', error.message);
    }
}

// GET /api/notes
router.get('/notes', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const orderBy = req.query.order_by || 'title:asc';
        const [orderColumn, orderDirection] = orderBy.split(':');

        let whereClause = { user_id: req.session.userId };
        let includeClause = [
            { model: Tag, through: { attributes: [] } },
            { model: Project, required: false, attributes: ['id', 'name'] },
        ];

        // Filter by tag
        if (req.query.tag) {
            includeClause[0].where = { name: req.query.tag };
            includeClause[0].required = true;
        }

        const notes = await Note.find(whereClause)
            .populate('tags')
            .populate('project_id', 'name')
            .sort({ [orderColumn]: orderDirection === 'asc' ? 1 : -1 });

        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/note/:id
router.get('/note/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const note = await Note.findOne({ _id: req.params.id, user_id: req.session.userId })
            .populate('tags')
            .populate('project_id', 'name');

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        res.json(note);
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/note
router.post('/note', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { title, content, project_id, tags } = req.body;

        const noteAttributes = {
            title,
            content,
            user_id: req.session.userId,
        };

        // Handle project assignment
        if (project_id && project_id.toString().trim()) {
            const project = await Project.findOne({ _id: project_id, user_id: req.session.userId });
            if (!project) {
                return res.status(400).json({ error: 'Invalid project.' });
            }
            noteAttributes.project_id = project_id;
        }

        const note = await Note.create(noteAttributes);

        // Handle tags - can be array of strings or array of objects with name property
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
        const noteWithAssociations = await Note.findById(note._id)
            .populate('tags')
            .populate('project_id', 'name');

        res.status(201).json(noteWithAssociations);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(400).json({
            error: 'There was a problem creating the note.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// PATCH /api/note/:id
router.patch('/note/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const note = await Note.findOne({ _id: req.params.id, user_id: req.session.userId });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        const { title, content, project_id, tags } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;

        // Handle project assignment
        if (project_id !== undefined) {
            if (project_id && project_id.toString().trim()) {
                const project = await Project.findOne({ _id: project_id, user_id: req.session.userId });
                if (!project) {
                    return res.status(400).json({ error: 'Invalid project.' });
                }
                updateData.project_id = project_id;
            } else {
                updateData.project_id = null;
            }
        }

        note.set(updateData);
        await note.save();

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
        const noteWithAssociations = await Note.findById(note._id)
            .populate('tags')
            .populate('project_id', 'name');

        res.json(noteWithAssociations);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(400).json({
            error: 'There was a problem updating the note.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/note/:id
router.delete('/note/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const note = await Note.findOne({ _id: req.params.id, user_id: req.session.userId });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        await note.destroy();
        res.json({ message: 'Note deleted successfully.' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(400).json({
            error: 'There was a problem deleting the note.',
        });
    }
});

module.exports = router;
