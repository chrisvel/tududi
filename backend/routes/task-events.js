const express = require('express');
const { Task, TaskEvent } = require('../models');
const { isValidUid } = require('../utils/slug-utils');
const {
    getTaskTimeline,
    getTaskCompletionTime,
    getUserProductivityMetrics,
    getTaskActivitySummary,
} = require('../services/taskEventService');
const { logError } = require('../services/logService');
const router = express.Router();

// GET /api/task/:uid/timeline - Get task event timeline
router.get('/task/:uid/timeline', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const permissionsService = require('../services/permissionsService');

        // Check if user has access to the task (either owns it or has access through shared project)
        const access = await permissionsService.getAccess(
            req.currentUser.id,
            'task',
            req.params.uid
        );

        if (access === 'none') {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = await Task.findOne({
            where: { uid: req.params.uid },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const timeline = await getTaskTimeline(task.id);

        res.json(timeline);
    } catch (error) {
        logError('Error fetching task timeline:', error);
        res.status(500).json({ error: 'Failed to fetch task timeline' });
    }
});

// GET /api/task/:uid/completion-time - Get task completion analytics
router.get('/task/:uid/completion-time', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid))
            return res.status(400).json({ error: 'Invalid UID' });

        const permissionsService = require('../services/permissionsService');

        // Check if user has access to the task (either owns it or has access through shared project)
        const access = await permissionsService.getAccess(
            req.currentUser.id,
            'task',
            req.params.uid
        );

        if (access === 'none') {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = await Task.findOne({
            where: { uid: req.params.uid },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const completionTime = await getTaskCompletionTime(task.id);

        if (!completionTime) {
            return res
                .status(404)
                .json({ error: 'Task completion data not found' });
        }

        res.json(completionTime);
    } catch (error) {
        logError('Error fetching task completion time:', error);
        res.status(500).json({ error: 'Failed to fetch task completion time' });
    }
});

// GET /api/user/productivity-metrics - Get user productivity metrics
router.get('/user/productivity-metrics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const metrics = await getUserProductivityMetrics(
            req.currentUser.id,
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null
        );

        res.json(metrics);
    } catch (error) {
        logError('Error fetching productivity metrics:', error);
        res.status(500).json({ error: 'Failed to fetch productivity metrics' });
    }
});

// GET /api/user/activity-summary - Get task activity summary
router.get('/user/activity-summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res
                .status(400)
                .json({ error: 'startDate and endDate are required' });
        }

        const activitySummary = await getTaskActivitySummary(
            req.currentUser.id,
            new Date(startDate),
            new Date(endDate)
        );

        res.json(activitySummary);
    } catch (error) {
        logError('Error fetching activity summary:', error);
        res.status(500).json({ error: 'Failed to fetch activity summary' });
    }
});

// GET /api/tasks/completion-analytics - Get completion time analytics for multiple tasks
router.get('/tasks/completion-analytics', async (req, res) => {
    try {
        const { limit = 50, offset = 0, projectUid } = req.query;

        // Get completed tasks for the user
        const { Task, Project } = require('../models');
        const { Op } = require('sequelize');

        const whereClause = {
            user_id: req.currentUser.id,
            status: 2, // completed
        };

        // If projectUid is provided, find the project and filter by its ID
        if (projectUid) {
            if (!isValidUid(projectUid)) {
                return res.status(400).json({ error: 'Invalid project UID' });
            }

            const project = await Project.findOne({
                where: { uid: projectUid, user_id: req.currentUser.id },
            });

            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            whereClause.project_id = project.id;
        }

        const completedTasks = await Task.findAll({
            where: whereClause,
            include: [
                { model: Project, attributes: ['name'], required: false },
            ],
            order: [['completed_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // Get completion time analytics for each task
        const analytics = [];
        for (const task of completedTasks) {
            const completionTime = await getTaskCompletionTime(task.id);
            if (completionTime) {
                analytics.push({
                    task_id: task.id,
                    task_name: task.name,
                    project_name: task.Project?.name || null,
                    ...completionTime,
                });
            }
        }

        // Calculate summary statistics
        const summary = {
            total_tasks: analytics.length,
            average_completion_hours:
                analytics.length > 0
                    ? analytics.reduce((sum, a) => sum + a.duration_hours, 0) /
                      analytics.length
                    : 0,
            median_completion_hours: 0,
            fastest_completion:
                analytics.length > 0
                    ? Math.min(...analytics.map((a) => a.duration_hours))
                    : 0,
            slowest_completion:
                analytics.length > 0
                    ? Math.max(...analytics.map((a) => a.duration_hours))
                    : 0,
        };

        // Calculate median
        if (analytics.length > 0) {
            const sorted = analytics
                .map((a) => a.duration_hours)
                .sort((a, b) => a - b);
            const middle = Math.floor(sorted.length / 2);
            summary.median_completion_hours =
                sorted.length % 2 === 0
                    ? (sorted[middle - 1] + sorted[middle]) / 2
                    : sorted[middle];
        }

        res.json({
            tasks: analytics,
            summary,
        });
    } catch (error) {
        logError('Error fetching completion analytics:', error);
        res.status(500).json({ error: 'Failed to fetch completion analytics' });
    }
});

module.exports = router;
