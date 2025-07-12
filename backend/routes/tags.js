const express = require('express');
const mongoose = require('mongoose');
const Tag = require('../models-mongo/tag');
const Task = require('../models-mongo/task');
const Note = require('../models-mongo/note');
const Project = require('../models-mongo/project');
const router = express.Router();

// GET /api/tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await Tag.find({ user: req.session.userId })
            .select('id name')
            .sort({ name: 'asc' });
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/tag/:identifier (supports both ID and name)
router.get('/tag/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let whereClause;
        
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            whereClause = { _id: identifier, user: req.session.userId };
        } else {
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user: req.session.userId };
        }

        const tag = await Tag.findOne(whereClause).select('id name');

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

        const tag = new Tag({
            name: name.trim(),
            user: req.session.userId,
        });

        await tag.save();

        res.status(201).json({
            id: tag._id,
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
        
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            whereClause = { _id: identifier, user: req.session.userId };
        } else {
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user: req.session.userId };
        }

        const tag = await Tag.findOne(whereClause);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        tag.name = name.trim();
        await tag.save();

        res.json({
            id: tag._id,
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
    try {
        const identifier = req.params.identifier;
        let whereClause;
        
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            whereClause = { _id: identifier, user: req.session.userId };
        } else {
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user: req.session.userId };
        }

        const tag = await Tag.findOne(whereClause);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Remove tag from all associated documents
        await Task.updateMany({ tags: tag._id }, { $pull: { tags: tag._id } });
        await Note.updateMany({ tags: tag._id }, { $pull: { tags: tag._id } });
        await Project.updateMany({ tags: tag._id }, { $pull: { tags: tag._id } });

        await tag.remove();

        res.json({ message: 'Tag successfully deleted' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(400).json({
            error: 'There was a problem deleting the tag.',
        });
    }
});

module.exports = router;
