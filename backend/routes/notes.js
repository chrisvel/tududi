const express = require('express');
const Note = require('../models-mongo/note');
const Tag = require('../models-mongo/tag');
const Project = require('../models-mongo/project');
const router = express.Router();

// Helper function to update note tags
async function updateNoteTags(note, tagsArray, userId) {
    if (!tagsArray || tagsArray.length === 0) {
        note.tags = [];
        return;
    }

    try {
        const tagNames = tagsArray.filter(
            (name, index, arr) => arr.indexOf(name) === index
        ); // unique
        const tags = await Promise.all(
            tagNames.map(async (name) => {
                let tag = await Tag.findOne({ name, user: userId });
                if (!tag) {
                    tag = new Tag({ name, user: userId });
                    await tag.save();
                }
                return tag;
            })
        );
        note.tags = tags.map(t => t._id);
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

        let whereClause = { user: req.session.userId };

        if (req.query.tag) {
            const tag = await Tag.findOne({ name: req.query.tag, user: req.session.userId });
            if (tag) {
                whereClause.tags = tag._id;
            } else {
                return res.json([]);
            }
        }

        const notes = await Note.find(whereClause)
            .populate('tags')
            .populate('project', 'id name')
            .sort({ [orderColumn]: orderDirection });

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

        const note = await Note.findOne({ _id: req.params.id, user: req.session.userId })
            .populate('tags')
            .populate('project', 'id name');

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

        const note = new Note({
            title,
            content,
            user: req.session.userId,
        });

        // Handle project assignment
        if (project_id && project_id.toString().trim()) {
            const project = await Project.findOne({
                _id: project_id,
                user: req.session.userId,
            });
            if (!project) {
                return res.status(400).json({ error: 'Invalid project.' });
            }
            note.project = project_id;
        }

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
        await note.save();

        // Reload note with associations
        const noteWithAssociations = await Note.findById(note._id)
            .populate('tags')
            .populate('project', 'id name');

        res.status(201).json(noteWithAssociations);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(400).json({
            error: 'There was a problem creating the note.',
            details: error.message,
        });
    }
});

// PATCH /api/note/:id
router.patch('/note/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const note = await Note.findOne({
            _id: req.params.id,
            user: req.session.userId,
        });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        const { title, content, project_id, tags } = req.body;

        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;

        // Handle project assignment
        if (project_id !== undefined) {
            if (project_id && project_id.toString().trim()) {
                const project = await Project.findOne({
                    _id: project_id,
                    user: req.session.userId,
                });
                if (!project) {
                    return res.status(400).json({ error: 'Invalid project.' });
                }
                note.project = project_id;
            } else {
                note.project = null;
            }
        }

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

        await note.save();

        // Reload note with associations
        const noteWithAssociations = await Note.findById(note._id)
            .populate('tags')
            .populate('project', 'id name');

        res.json(noteWithAssociations);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(400).json({
            error: 'There was a problem updating the note.',
            details: error.message,
        });
    }
});

// DELETE /api/note/:id
router.delete('/note/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const note = await Note.findOneAndDelete({
            _id: req.params.id,
            user: req.session.userId,
        });

        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        res.json({ message: 'Note deleted successfully.' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(400).json({
            error: 'There was a problem deleting the note.',
        });
    }
});

module.exports = router;
