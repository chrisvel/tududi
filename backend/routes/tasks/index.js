const express = require('express');
const router = express.Router();

const { Task, TaskEvent, sequelize } = require('../../models');
const taskRepository = require('../../repositories/TaskRepository');
const {
    resetQueryCounter,
    getQueryStats,
    enableQueryLogging,
} = require('../../middleware/queryLogger');

const {
    generateRecurringTasks,
    handleTaskCompletion,
} = require('../../services/recurringTaskService');
const { logError } = require('../../services/logService');
const { logEvent } = require('../../services/taskEventService');

const { serializeTask, serializeTasks } = require('./core/serializers');
const { updateTaskTags } = require('./operations/tags');
const { filterTasksByParams } = require('./queries/query-builders');
const {
    getSafeTimezone,
    getTodayBoundsInUTC,
} = require('../../utils/timezone-utils');

const {
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
} = require('./utils/validation');
const {
    buildTaskAttributes,
    buildUpdateAttributes,
} = require('./core/builders');
const { createSubtasks, updateSubtasks } = require('./operations/subtasks');
const { handleCompletionStatus } = require('./operations/completion');
const { captureOldValues, logTaskChanges } = require('./utils/logging');
const {
    handleParentChildOnStatusChange,
} = require('./operations/parent-child');
const {
    TASK_INCLUDES,
    TASK_INCLUDES_WITH_SUBTASKS,
} = require('./utils/constants');

const {
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
    addPerformanceHeaders,
} = require('./operations/list');

const {
    handleRecurrenceUpdate,
    calculateNextIterations,
} = require('./operations/recurring');

const { getTaskMetrics } = require('./queries/metrics-computation');

const { getSubtasks } = require('./operations/subtasks');

const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('./middleware/access');

if (process.env.NODE_ENV === 'development') {
    enableQueryLogging();
}

router.get('/tasks', async (req, res) => {
    const startTime = Date.now();
    resetQueryCounter();

    try {
        const {
            type,
            groupBy,
            maxDays,
            order_by,
            include_lists,
            limit: limitParam,
            offset: offsetParam,
        } = req.query;
        const { id: userId, timezone } = req.currentUser;

        await handleRecurringTasks(userId, type);

        let tasks = await filterTasksByParams(req.query, userId, timezone);

        // For type=today, exclude templates that have instances with due_date in today's range
        if (type === 'today') {
            const safeTimezone = getSafeTimezone(timezone);
            const todayBounds = getTodayBoundsInUTC(safeTimezone);

            // Find all instances with due_date in today's range
            const instancesForToday = tasks.filter(
                (t) =>
                    t.recurring_parent_id &&
                    t.due_date &&
                    new Date(t.due_date) >= todayBounds.start &&
                    new Date(t.due_date) <= todayBounds.end
            );

            // Get parent IDs of those instances
            const parentIdsWithTodayInstances = new Set(
                instancesForToday.map((t) => t.recurring_parent_id)
            );

            // Filter out templates that have instances for today
            tasks = tasks.filter(
                (t) =>
                    !t.recurrence_type ||
                    t.recurrence_type === 'none' ||
                    t.recurring_parent_id !== null ||
                    !parentIdsWithTodayInstances.has(t.id)
            );
        }

        // Pagination support
        const hasPagination =
            limitParam !== undefined || offsetParam !== undefined;
        const totalCount = tasks.length;
        let paginatedTasks = tasks;

        if (hasPagination) {
            const limit = parseInt(limitParam, 10) || 20;
            const offset = parseInt(offsetParam, 10) || 0;
            paginatedTasks = tasks.slice(offset, offset + limit);
        }

        const groupedTasks = await buildGroupedTasks(
            paginatedTasks,
            type,
            groupBy,
            maxDays,
            order_by,
            timezone
        );

        const serializationOptions =
            type === 'today' ? { preserveOriginalName: true } : {};

        const response = {
            tasks: await serializeTasks(
                paginatedTasks,
                timezone,
                serializationOptions
            ),
        };

        const serializedGrouped = await serializeGroupedTasks(
            groupedTasks,
            timezone
        );
        if (serializedGrouped) {
            response.groupedTasks = serializedGrouped;
        }

        await addDashboardLists(
            response,
            userId,
            timezone,
            type,
            include_lists,
            serializationOptions
        );

        // Add pagination metadata if pagination was requested
        if (hasPagination) {
            const limit = parseInt(limitParam, 10) || 20;
            const offset = parseInt(offsetParam, 10) || 0;
            response.pagination = {
                total: totalCount,
                limit: limit,
                offset: offset,
                hasMore: offset + paginatedTasks.length < totalCount,
            };
        }

        addPerformanceHeaders(res, startTime, getQueryStats());
        res.json(response);
    } catch (error) {
        logError('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/tasks/metrics', async (req, res) => {
    try {
        const response = await getTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone,
            req.query.type
        );

        res.json(response);
    } catch (error) {
        logError('Error fetching task metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/task', async (req, res) => {
    try {
        const { name, project_id, parent_task_id, tags, Tags, subtasks } =
            req.body;
        const tagsData = tags || Tags;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Task name is required.' });
        }

        const timezone = getSafeTimezone(req.currentUser.timezone);
        const taskAttributes = buildTaskAttributes(
            req.body,
            req.currentUser.id,
            timezone
        );

        // Validate defer_until vs due_date
        try {
            validateDeferUntilAndDueDate(
                taskAttributes.defer_until,
                taskAttributes.due_date
            );
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        try {
            const validProjectId = await validateProjectAccess(
                project_id,
                req.currentUser.id
            );
            if (validProjectId) taskAttributes.project_id = validProjectId;
        } catch (error) {
            return res
                .status(error.message === 'Forbidden' ? 403 : 400)
                .json({ error: error.message });
        }

        try {
            const validParentId = await validateParentTaskAccess(
                parent_task_id,
                req.currentUser.id
            );
            if (validParentId) taskAttributes.parent_task_id = validParentId;
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        const task = await taskRepository.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);
        await createSubtasks(task.id, subtasks, req.currentUser.id);

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES,
        });

        if (!taskWithAssociations) {
            logError('Failed to reload created task:', task.id);
            const fallbackTask = {
                ...task.toJSON(),
                tags: [],
                Project: null,
                subtasks: [],
                today_move_count: 0,
                due_date: task.due_date
                    ? task.due_date instanceof Date
                        ? task.due_date.toISOString().split('T')[0]
                        : new Date(task.due_date).toISOString().split('T')[0]
                    : null,
                completed_at: task.completed_at
                    ? task.completed_at instanceof Date
                        ? task.completed_at.toISOString()
                        : new Date(task.completed_at).toISOString()
                    : null,
            };
            return res.status(201).json(fallbackTask);
        }

        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        res.status(201).json(serializedTask);
    } catch (error) {
        logError('Error creating task:', error);
        logError('Error stack:', error.stack);
        logError('Error name:', error.name);
        res.status(400).json({
            error: 'There was a problem creating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.get('/task/:uid', requireTaskReadAccess, async (req, res) => {
    try {
        const task = await taskRepository.findByUid(req.params.uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(
            task,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        res.json(serializedTask);
    } catch (error) {
        logError('Error fetching task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/task/:uid', requireTaskWriteAccess, async (req, res) => {
    try {
        const {
            status,
            project_id,
            parent_task_id,
            tags,
            Tags,
            subtasks,
            today,
            recurrence_type,
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekday,
            recurrence_month_day,
            recurrence_week_of_month,
            completion_based,
            update_parent_recurrence,
        } = req.body;

        const tagsData = tags || Tags;

        const task = await taskRepository.findByUid(req.params.uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const oldValues = captureOldValues(task);
        const oldStatus = task.status;

        if (update_parent_recurrence && task.recurring_parent_id) {
            const parentTask = await taskRepository.findByIdAndUser(
                task.recurring_parent_id,
                req.currentUser.id
            );

            if (parentTask) {
                await parentTask.update({
                    recurrence_type:
                        recurrence_type !== undefined
                            ? recurrence_type
                            : parentTask.recurrence_type,
                    recurrence_interval:
                        recurrence_interval !== undefined
                            ? recurrence_interval
                            : parentTask.recurrence_interval,
                    recurrence_end_date:
                        recurrence_end_date !== undefined
                            ? recurrence_end_date
                            : parentTask.recurrence_end_date,
                    recurrence_weekday:
                        recurrence_weekday !== undefined
                            ? recurrence_weekday
                            : parentTask.recurrence_weekday,
                    recurrence_month_day:
                        recurrence_month_day !== undefined
                            ? recurrence_month_day
                            : parentTask.recurrence_month_day,
                    recurrence_week_of_month:
                        recurrence_week_of_month !== undefined
                            ? recurrence_week_of_month
                            : parentTask.recurrence_week_of_month,
                    completion_based:
                        completion_based !== undefined
                            ? completion_based
                            : parentTask.completion_based,
                });
            }
        }

        const timezone = getSafeTimezone(req.currentUser.timezone);
        const taskAttributes = buildUpdateAttributes(req.body, task, timezone);

        // Validate defer_until vs due_date
        // Use the new values if provided, otherwise use existing task values
        try {
            const finalDeferUntil =
                taskAttributes.defer_until !== undefined
                    ? taskAttributes.defer_until
                    : task.defer_until;
            const finalDueDate =
                taskAttributes.due_date !== undefined
                    ? taskAttributes.due_date
                    : task.due_date;

            validateDeferUntilAndDueDate(finalDeferUntil, finalDueDate);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        if (
            today !== undefined &&
            task.today === true &&
            today === false &&
            task.status === Task.STATUS.IN_PROGRESS
        ) {
            taskAttributes.status = Task.STATUS.NOT_STARTED;
        }

        await handleCompletionStatus(taskAttributes, status, task);

        if (project_id !== undefined) {
            try {
                const validProjectId = await validateProjectAccess(
                    project_id,
                    req.currentUser.id
                );
                taskAttributes.project_id = validProjectId;
            } catch (error) {
                return res
                    .status(error.message === 'Forbidden' ? 403 : 400)
                    .json({ error: error.message });
            }
        }

        if (parent_task_id !== undefined) {
            if (parent_task_id && parent_task_id.toString().trim()) {
                try {
                    const validParentId = await validateParentTaskAccess(
                        parent_task_id,
                        req.currentUser.id
                    );
                    taskAttributes.parent_task_id = validParentId;
                } catch (error) {
                    return res.status(400).json({ error: error.message });
                }
            } else {
                taskAttributes.parent_task_id = null;
            }
        }

        const recurrenceFields = [
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_weekdays',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        const recurrenceChanged = await handleRecurrenceUpdate(
            task,
            recurrenceFields,
            req.body
        );

        await task.update(taskAttributes);

        let nextTask = null;
        if (status !== undefined) {
            await handleParentChildOnStatusChange(
                task,
                oldStatus,
                taskAttributes.status,
                req.currentUser.id
            );

            if (
                taskAttributes.status === Task.STATUS.DONE ||
                taskAttributes.status === 'done'
            ) {
                nextTask = await handleTaskCompletion(task);
            }
        }

        if (recurrenceChanged && task.recurrence_type !== 'none') {
            const newRecurrenceType =
                recurrence_type !== undefined
                    ? recurrence_type
                    : task.recurrence_type;
            if (newRecurrenceType !== 'none') {
                try {
                    await generateRecurringTasks(req.currentUser.id, 7);
                } catch (error) {
                    logError(
                        'Error generating new recurring tasks after update:',
                        error
                    );
                }
            }
        }

        await updateTaskTags(task, tagsData, req.currentUser.id);
        await updateSubtasks(task.id, subtasks, req.currentUser.id);
        await logTaskChanges(
            task,
            oldValues,
            req.body,
            tagsData,
            req.currentUser.id
        );

        if (today !== undefined && today !== oldValues.today) {
            try {
                await logEvent({
                    taskId: task.id,
                    userId: req.currentUser.id,
                    eventType: 'today_changed',
                    fieldName: 'today',
                    oldValue: oldValues.today,
                    newValue: today,
                    metadata: { source: 'web', action: 'update_today' },
                });
            } catch (eventError) {
                logError('Error logging today change event:', eventError);
            }
        }

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES,
        });

        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        if (nextTask) {
            serializedTask.next_task = {
                ...nextTask.toJSON(),
                due_date: nextTask.due_date
                    ? nextTask.due_date.toISOString().split('T')[0]
                    : null,
            };
        }

        res.json(serializedTask);
    } catch (error) {
        logError('Error updating task:', error);
        res.status(400).json({
            error: 'There was a problem updating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.delete('/task/:uid', requireTaskWriteAccess, async (req, res) => {
    try {
        const task = await taskRepository.findByUid(req.params.uid);

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const taskId = task.id;

        const childTasks = await taskRepository.findRecurringChildren(taskId);

        if (childTasks.length > 0) {
            const now = new Date();

            const futureInstances = childTasks.filter((child) => {
                if (!child.due_date) return true;
                return new Date(child.due_date) > now;
            });

            const pastInstances = childTasks.filter((child) => {
                if (!child.due_date) return false;
                return new Date(child.due_date) <= now;
            });

            for (const futureInstance of futureInstances) {
                await futureInstance.destroy();
            }

            for (const pastInstance of pastInstances) {
                await pastInstance.update({
                    recurring_parent_id: null,
                    recurrence_type: 'none',
                    recurrence_interval: null,
                    recurrence_end_date: null,
                    last_generated_date: null,
                    recurrence_weekday: null,
                    recurrence_month_day: null,
                    recurrence_week_of_month: null,
                    completion_based: false,
                });
            }
        }

        await sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            await TaskEvent.destroy({
                where: { task_id: taskId },
                force: true,
            });

            await sequelize.query('DELETE FROM tasks_tags WHERE task_id = ?', {
                replacements: [taskId],
            });

            await taskRepository.clearRecurringParent(taskId);

            await task.destroy({ force: true });
        } finally {
            await sequelize.query('PRAGMA foreign_keys = ON');
        }

        res.json({ message: 'Task successfully deleted' });
    } catch (error) {
        res.status(400).json({
            error: 'There was a problem deleting the task.',
        });
    }
});

router.get('/task/:id/subtasks', async (req, res) => {
    try {
        const result = await getSubtasks(
            req.params.id,
            req.currentUser.id,
            req.currentUser.timezone
        );

        if (result.error === 'Forbidden') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (result.error === 'Not found') {
            return res.json([]);
        }

        res.json(result.subtasks);
    } catch (error) {
        logError('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/tasks/generate-recurring', async (req, res) => {
    try {
        const newTasks = await generateRecurringTasks(req.currentUser.id);

        res.json({
            message: `Generated ${newTasks.length} recurring tasks`,
            tasks: newTasks.map((task) => ({
                ...task.toJSON(),
                due_date: task.due_date
                    ? task.due_date.toISOString().split('T')[0]
                    : null,
            })),
        });
    } catch (error) {
        logError('Error generating recurring tasks:', error);
        res.status(500).json({ error: 'Failed to generate recurring tasks' });
    }
});

router.get('/task/:id/next-iterations', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        const task = await taskRepository.findByIdAndUser(
            taskId,
            req.currentUser.id
        );

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return res.json({ iterations: [] });
        }

        const iterations = await calculateNextIterations(
            task,
            req.query.startFromDate,
            req.currentUser.timezone
        );

        res.json({ iterations });
    } catch (error) {
        logError('Error getting next iterations:', error);
        res.status(500).json({ error: 'Failed to get next iterations' });
    }
});

module.exports = router;
