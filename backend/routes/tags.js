const express = require('express');
const mongoose = require('mongoose');
const Tag = require('../models/tag');
const Task = require('../models/task');
const Note = require('../models/note');
const Project = require('../models/project');
const router = express.Router();

// GET /api/tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await Tag.find({ user_id: req.currentUser.id })
            .select('name')
            .sort({ name: 1 });
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
        
        // Check if identifier is a number (ID) or string (name)
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            // It's a valid ObjectId
            whereClause = { _id: identifier, user_id: req.currentUser.id };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne(whereClause).select('name');

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
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            // It's a valid ObjectId
            whereClause = { _id: identifier, user_id: req.currentUser.id };
        } else {
            // It's a tag name - decode URI component to handle special characters
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne(whereClause);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        tag.set({ name: name.trim() });
        await tag.save();

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
    try {
        const identifier = req.params.identifier;
        let whereClause;
        
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            whereClause = { _id: identifier, user_id: req.currentUser.id };
        } else {
            const tagName = decodeURIComponent(identifier);
            whereClause = { name: tagName, user_id: req.currentUser.id };
        }

        const tag = await Tag.findOne(whereClause);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Remove tag from tasks, notes, and projects
        await Task.updateMany(
            { user_id: req.currentUser.id, tags: tag._id },
            { $pull: { tags: tag._id } }
        );
        await Note.updateMany(
            { user_id: req.currentUser.id, tags: tag._id },
            { $pull: { tags: tag._id } }
        );
        await Project.updateMany(
            { user_id: req.currentUser.id, tags: tag._id },
            { $pull: { tags: tag._id } }
        );

        // Delete the tag itself
        await tag.deleteOne();

        res.json({ message: 'Tag successfully deleted' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(400).json({
            error: 'There was a problem deleting the tag.',
        });
    }
});

module.exports = router;
