const express = require('express');
const router = express.Router();
const {
    generateRecurringTasksWithLock,
} = require('../../services/recurringTaskService');
const { logError } = require('../../services/logService');
const {
    filterTasksByParams,
    computeTaskMetrics,
    serializeTasks,
    buildMetricsResponse,
    groupTasksByDay,
} = require('./helpers');

router.get('/tasks', async (req, res) => {
    try {
        // Generate recurring tasks for upcoming view with locking
        if (req.query.type === 'upcoming') {
            await generateRecurringTasksWithLock(req.currentUser.id, 7);
        }

        // Fetch tasks based on query parameters
        const tasks = await filterTasksByParams(
            req.query,
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Group tasks by day if requested
        let groupedTasks = null;
        if (req.query.type === 'upcoming' && req.query.groupBy === 'day') {
            const maxDays = req.query.maxDays
                ? parseInt(req.query.maxDays, 10)
                : 7;
            const dayGroupingOrderBy = req.query.order_by || 'due_date:asc';
            groupedTasks = await groupTasksByDay(
                tasks,
                req.currentUser.timezone,
                maxDays,
                dayGroupingOrderBy
            );
        }

        // Compute metrics
        const metrics = await computeTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Determine serialization options
        const serializationOptions =
            req.query.type === 'today' ? { preserveOriginalName: true } : {};

        // Build response
        const response = {
            tasks: await serializeTasks(
                tasks,
                req.currentUser.timezone,
                serializationOptions
            ),
            metrics: await buildMetricsResponse(
                metrics,
                req.currentUser.timezone,
                serializationOptions
            ),
        };

        // Add grouped tasks if requested
        if (groupedTasks) {
            response.groupedTasks = {};
            for (const [groupName, groupTasks] of Object.entries(
                groupedTasks
            )) {
                response.groupedTasks[groupName] = await serializeTasks(
                    groupTasks,
                    req.currentUser.timezone
                );
            }
        }

        res.json(response);
    } catch (error) {
        logError('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
