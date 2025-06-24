const express = require('express');
const { Tag, Task, Note, Project, sequelize } = require('../models');
const router = express.Router();

// GET /api/tags
router.get('/tags', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tags = await Tag.findAll({
      where: { user_id: req.session.userId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tag/:id
router.get('/tag/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tag = await Tag.findOne({
      where: { id: req.params.id, user_id: req.session.userId },
      attributes: ['id', 'name']
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
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const tag = await Tag.create({
      name: name.trim(),
      user_id: req.session.userId
    });

    res.status(201).json({
      id: tag.id,
      name: tag.name
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(400).json({ error: 'There was a problem creating the tag.' });
  }
});

// PATCH /api/tag/:id
router.patch('/tag/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tag = await Tag.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
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
      name: tag.name
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(400).json({ error: 'There was a problem updating the tag.' });
  }
});

// DELETE /api/tag/:id
router.delete('/tag/:id', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tag = await Tag.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });

    if (!tag) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Use transaction to ensure all deletions happen atomically
    // Remove all associations before deleting the tag by manually deleting from junction tables
    // Handle both old and new task-tag junction tables
    await sequelize.query('DELETE FROM tasks_tags WHERE tag_id = ?', {
      replacements: [tag.id],
      type: sequelize.QueryTypes.DELETE,
      transaction
    });
    
    await sequelize.query('DELETE FROM tags_tasks WHERE tag_id = ?', {
      replacements: [tag.id],
      type: sequelize.QueryTypes.DELETE,
      transaction
    });
    
    await sequelize.query('DELETE FROM notes_tags WHERE tag_id = ?', {
      replacements: [tag.id],
      type: sequelize.QueryTypes.DELETE,
      transaction
    });
    
    await sequelize.query('DELETE FROM projects_tags WHERE tag_id = ?', {
      replacements: [tag.id],
      type: sequelize.QueryTypes.DELETE,
      transaction
    });

    // Now safely delete the tag
    await tag.destroy({ transaction });
    
    await transaction.commit();
    res.json({ message: 'Tag successfully deleted' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting tag:', error);
    res.status(400).json({ error: 'There was a problem deleting the tag.' });
  }
});

module.exports = router;