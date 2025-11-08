const express = require('express');
const router = express.Router();
const { Task, Tag, Project } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { logError } = require('../../services/logService');
const { serializeTask } = require('./helpers');

// GET /api/task/:id/subtasks
router.get('/task/:id/subtasks', async (req, res) => {
    try {
        // Ensure parent visibility first
        const parent = await Task.findOne({ where: { id: req.params.id } });
        if (!parent) {
            return res.json([]);
        }
        const pAccess = await permissionsService.getAccess(
            req.currentUser.id,
            'task',
            parent.uid
        );
        if (pAccess === 'none') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const subtasks = await Task.findAll({
            where: {
                parent_task_id: req.params.id,
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
            ],
            order: [['created_at', 'ASC']],
        });

        const serializedSubtasks = await Promise.all(
            subtasks.map((subtask) =>
                serializeTask(subtask, req.currentUser.timezone)
            )
        );

        res.json(serializedSubtasks);
    } catch (error) {
        logError('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
