const express = require('express');
const router = express.Router();
const {
    generateRecurringTasks,
} = require('../../services/recurringTaskService');
const { logError } = require('../../services/logService');
const {
    filterTasksByParams,
    computeTaskMetrics,
    serializeTask,
    groupTasksByDay,
} = require('./helpers');

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get tasks with filtering and grouping options
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [today, upcoming, completed, archived, all]
 *         description: Filter tasks by type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, archived]
 *         description: Filter by task status
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, project]
 *         description: Group tasks by day or project
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *           example: "created_at:desc"
 *         description: Sort order (field:direction)
 *     responses:
 *       200:
 *         description: List of tasks with metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     total_open_tasks:
 *                       type: integer
 *                     tasks_pending_over_month:
 *                       type: integer
 *                     tasks_in_progress_count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/tasks', async (req, res) => {
    try {
        // Generate recurring tasks for upcoming view, but prevent concurrent execution
        if (req.query.type === 'upcoming') {
            // Use a simple lock to prevent concurrent generation per user
            const lockKey = `generating_recurring_${req.currentUser.id}`;
            if (!global[lockKey]) {
                global[lockKey] = true;
                try {
                    console.log(
                        '🔄 GENERATING recurring tasks for upcoming view (7 days)'
                    );
                    await generateRecurringTasks(req.currentUser.id, 7);
                } finally {
                    delete global[lockKey];
                }
            }
        }

        const tasks = await filterTasksByParams(
            req.query,
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Debug logging for upcoming view
        if (req.query.type === 'upcoming') {
            console.log('🔍 UPCOMING TASKS DEBUG:');
            console.log(`  Total tasks returned: ${tasks.length}`);
            if (tasks.length > 0) {
                tasks.forEach((task) => {
                    console.log(
                        `- ID: ${task.id}, Name: "${task.name}", Due: ${task.due_date}, Recur: ${task.recurrence_type}, Parent: ${task.recurring_parent_id}, Status: ${task.status}`
                    );
                });
            } else {
                console.log('  ⚠️ No tasks matched the query!');
            }
        }

        // Group upcoming tasks by day of week if requested
        let groupedTasks = null;
        if (req.query.type === 'upcoming' && req.query.groupBy === 'day') {
            // Always show 7 days (whole week including tomorrow)
            const maxDays = req.query.maxDays
                ? parseInt(req.query.maxDays, 10)
                : 7;

            // For upcoming kanban view, sort tasks by due date within each day column
            const dayGroupingOrderBy = req.query.order_by || 'due_date:asc';
            groupedTasks = await groupTasksByDay(
                tasks,
                req.currentUser.timezone,
                maxDays,
                dayGroupingOrderBy
            );
        }

        const metrics = await computeTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Preserve original names for recurring tasks in 'today' view for productivity assistant
        const serializationOptions =
            req.query.type === 'today' ? { preserveOriginalName: true } : {};

        const response = {
            tasks: await Promise.all(
                tasks.map((task) =>
                    serializeTask(
                        task,
                        req.currentUser.timezone,
                        serializationOptions
                    )
                )
            ),
            metrics: {
                total_open_tasks: metrics.total_open_tasks,
                tasks_pending_over_month: metrics.tasks_pending_over_month,
                tasks_in_progress_count: metrics.tasks_in_progress_count,
                tasks_in_progress: await Promise.all(
                    metrics.tasks_in_progress.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                tasks_due_today: await Promise.all(
                    metrics.tasks_due_today.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                today_plan_tasks: await Promise.all(
                    metrics.today_plan_tasks.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                suggested_tasks: await Promise.all(
                    metrics.suggested_tasks.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                tasks_completed_today: await Promise.all(
                    metrics.tasks_completed_today.map(async (task) => {
                        const serialized = await serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        );
                        return {
                            ...serialized,
                            completed_at: task.completed_at
                                ? task.completed_at.toISOString()
                                : null,
                        };
                    })
                ),
                weekly_completions: metrics.weekly_completions,
            },
        };

        // Add grouped tasks if requested
        if (groupedTasks) {
            response.groupedTasks = {};
            for (const [groupName, groupTasks] of Object.entries(
                groupedTasks
            )) {
                response.groupedTasks[groupName] = await Promise.all(
                    groupTasks.map((task) =>
                        serializeTask(task, req.currentUser.timezone)
                    )
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
