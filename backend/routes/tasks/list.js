const express = require('express');
const router = express.Router();
const {
    generateRecurringTasksWithLock,
} = require('../../services/recurringTaskService');
const { logError } = require('../../services/logService');
const {
    filterTasksByParams,
    serializeTasks,
    groupTasksByDay,
} = require('./helpers');
const {
    resetQueryCounter,
    getQueryStats,
    enableQueryLogging,
} = require('../../middleware/queryLogger');

// Enable query logging for debugging
enableQueryLogging();

router.get('/tasks', async (req, res) => {
    const startTime = Date.now();
    resetQueryCounter();

    console.log('\n🔍 === NEW REQUEST TO /api/tasks ===');
    console.log('Query params:', req.query);
    console.log(
        'Auth method:',
        req.authToken ? 'Bearer Token' : 'Cookie Session'
    );

    // Create request-scoped permission cache
    const permissionCache = new Map();

    try {
        // Generate recurring tasks for upcoming view with locking
        if (req.query.type === 'upcoming') {
            await generateRecurringTasksWithLock(req.currentUser.id, 7);
        }

        // Fetch tasks based on query parameters (with cache)
        const tasks = await filterTasksByParams(
            req.query,
            req.currentUser.id,
            req.currentUser.timezone,
            permissionCache
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

        // Determine serialization options
        const serializationOptions =
            req.query.type === 'today' ? { preserveOriginalName: true } : {};

        // Build response - TASKS ONLY (no metrics)
        const response = {
            tasks: await serializeTasks(
                tasks,
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

        // For today type, optionally include dashboard task lists
        if (
            req.query.type === 'today' &&
            req.query.include_lists === 'true'
        ) {
            const { computeTaskMetrics } = require('./helpers');
            const metricsData = await computeTaskMetrics(
                req.currentUser.id,
                req.currentUser.timezone,
                permissionCache
            );

            // Serialize the task lists (but metrics endpoint only returns counts)
            const { serializeTasks: serialize } = require('./helpers');
            response.tasks_in_progress = await serialize(
                metricsData.tasks_in_progress,
                req.currentUser.timezone,
                serializationOptions
            );
            response.tasks_due_today = await serialize(
                metricsData.tasks_due_today,
                req.currentUser.timezone,
                serializationOptions
            );
            response.suggested_tasks = await serialize(
                metricsData.suggested_tasks,
                req.currentUser.timezone,
                serializationOptions
            );
            response.tasks_completed_today = await serialize(
                metricsData.tasks_completed_today,
                req.currentUser.timezone,
                serializationOptions
            );
        }

        const totalTime = Date.now() - startTime;
        const queryStats = getQueryStats();

        console.log('\n📊 === REQUEST COMPLETE ===');
        console.log(`⏱️  Total time: ${totalTime}ms`);
        console.log(`🔍 Query count: ${queryStats.count}`);
        console.log(
            `📈 Avg query time: ${(totalTime / (queryStats.count || 1)).toFixed(2)}ms`
        );
        console.log(`📦 Tasks returned: ${response.tasks?.length || 0}`);
        console.log(`📊 Metrics included: ${!!response.metrics}`);

        if (queryStats.count > 10) {
            console.log('\n⚠️  WARNING: More than 10 queries detected!');
            console.log('Top 5 slowest queries:');
            queryStats.queries
                .sort((a, b) => b.time - a.time)
                .slice(0, 5)
                .forEach((q) => {
                    console.log(
                        `  [${q.num}] ${q.time}ms: ${q.sql.substring(0, 150)}...`
                    );
                });
        }
        console.log('='.repeat(50) + '\n');

        // Add performance timing header
        res.set('X-Response-Time', `${totalTime}ms`);
        res.set('X-Query-Count', queryStats.count.toString());

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
