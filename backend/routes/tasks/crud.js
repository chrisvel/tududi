const express = require('express');
const router = express.Router();
const { Task, Tag, Project, TaskEvent, sequelize } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { hasAccess } = require('../../middleware/authorize');
const {
    generateRecurringTasks,
} = require('../../services/recurringTaskService');
const { logEvent, logTaskUpdate } = require('../../services/taskEventService');
const {
    processDueDateForStorage,
    getSafeTimezone,
} = require('../../utils/timezone-utils');
const { logError } = require('../../services/logService');
const { serializeTask, updateTaskTags } = require('./helpers');

/**
 * @swagger
 * /api/task:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *                 example: "Complete project documentation"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *               recurrence_type:
 *                 type: string
 *                 enum: [daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/task', async (req, res) => {
    try {
        const {
            name,
            priority,
            due_date,
            status,
            note,
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
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Task name is required.' });
        }

        const taskAttributes = {
            name: name.trim(),
            priority:
                priority !== undefined
                    ? typeof priority === 'string'
                        ? Task.getPriorityValue(priority)
                        : priority
                    : null,
            due_date: processDueDateForStorage(
                due_date,
                getSafeTimezone(req.currentUser.timezone)
            ),
            status:
                status !== undefined
                    ? typeof status === 'string'
                        ? Task.getStatusValue(status)
                        : status
                    : Task.STATUS.NOT_STARTED,
            note,
            today: today !== undefined ? today : false,
            user_id: req.currentUser.id,
            recurrence_type: recurrence_type || 'none',
            recurrence_interval: recurrence_interval || null,
            recurrence_end_date: recurrence_end_date || null,
            recurrence_weekday:
                recurrence_weekday !== undefined ? recurrence_weekday : null,
            recurrence_month_day:
                recurrence_month_day !== undefined
                    ? recurrence_month_day
                    : null,
            recurrence_week_of_month:
                recurrence_week_of_month !== undefined
                    ? recurrence_week_of_month
                    : null,
            completion_based: completion_based || false,
        };

        // Handle project assignment
        if (project_id && project_id.toString().trim()) {
            const project = await Project.findOne({
                where: { id: project_id },
            });
            if (!project) {
                return res.status(400).json({ error: 'Invalid project.' });
            }
            const projectAccess = await permissionsService.getAccess(
                req.currentUser.id,
                'project',
                project.uid
            );
            const isOwner = project.user_id === req.currentUser.id;
            const canWrite =
                isOwner || projectAccess === 'rw' || projectAccess === 'admin';
            if (!canWrite) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            taskAttributes.project_id = project_id;
        }

        // Handle parent task assignment
        if (parent_task_id && parent_task_id.toString().trim()) {
            const parentTask = await Task.findOne({
                where: { id: parent_task_id },
            });
            if (!parentTask) {
                return res.status(400).json({ error: 'Invalid parent task.' });
            }
            const parentAccess = await permissionsService.getAccess(
                req.currentUser.id,
                'task',
                parentTask.uid
            );
            const isOwner = parentTask.user_id === req.currentUser.id;
            const canWrite =
                isOwner || parentAccess === 'rw' || parentAccess === 'admin';
            if (!canWrite) {
                return res.status(400).json({ error: 'Invalid parent task.' });
            }
            taskAttributes.parent_task_id = parent_task_id;
        }

        const task = await Task.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);

        // Handle subtasks creation
        if (subtasks && Array.isArray(subtasks)) {
            const subtaskPromises = subtasks
                .filter((subtask) => subtask.name && subtask.name.trim())
                .map((subtask) =>
                    Task.create({
                        name: subtask.name.trim(),
                        parent_task_id: task.id,
                        user_id: req.currentUser.id,
                        priority: Task.PRIORITY.LOW,
                        status: Task.STATUS.NOT_STARTED,
                        today: false,
                        recurrence_type: 'none',
                        completion_based: false,
                    })
                );

            await Promise.all(subtaskPromises);
        }

        // Log task creation event (temporarily disabled due to foreign key constraint issues)
        /*
        try {
            await logTaskCreated(
                task.id,
                req.currentUser.id,
                {
                    name: task.name,
                    status: task.status,
                    priority: task.priority,
                    due_date: task.due_date,
                    project_id: task.project_id,
                },
                { source: 'web' }
            );
        } catch (eventError) {
            logError('Error logging task creation event:', eventError);
            // Don't fail the request if event logging fails
        }
        */

        // Reload task with associations
        const taskWithAssociations = await Task.findByPk(task.id, {
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
        });

        if (!taskWithAssociations) {
            logError('Failed to reload created task:', task.id);
            // Return the original task data as fallback
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

        // Add cache-busting headers to prevent HTTP caching
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

// GET /api/task/:uid - fetch task by UID only
router.get(
    '/task/:uid',
    hasAccess(
        'ro',
        'task',
        async (req) => {
            // Return the UID directly for permission checking
            return req.params.uid;
        },
        { notFoundMessage: 'Task not found.' }
    ),
    async (req, res) => {
        try {
            const { uid } = req.params;

            const task = await Task.findOne({
                where: { uid },
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
                    {
                        model: Task,
                        as: 'Subtasks',
                        required: false,
                        include: [
                            {
                                model: Tag,
                                attributes: ['id', 'name', 'uid'],
                                through: { attributes: [] },
                            },
                        ],
                    },
                ],
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
    }
);

/**
 * @swagger
 * /api/task/{id}:
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag names
 *               recurrence_type:
 *                 type: string
 *                 enum: [daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.patch(
    '/task/:id',
    hasAccess(
        'rw',
        'task',
        async (req) => {
            const t = await Task.findOne({
                where: { id: req.params.id },
                attributes: ['uid'],
            });
            return t?.uid;
        },
        { notFoundMessage: 'Task not found.' }
    ),
    async (req, res) => {
        try {
            const {
                name,
                priority,
                status,
                note,
                due_date,
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

            // Handle both tags and Tags (Sequelize association format)
            const tagsData = tags || Tags;

            const task = await Task.findOne({
                where: { id: req.params.id },
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                    },
                ],
            });

            if (!task) {
                return res.status(404).json({ error: 'Task not found.' });
            }
            // access ensured by middleware

            // Capture old values for event logging
            const oldValues = {
                name: task.name,
                status: task.status,
                priority: task.priority,
                due_date: task.due_date,
                project_id: task.project_id,
                note: task.note,
                recurrence_type: task.recurrence_type,
                recurrence_interval: task.recurrence_interval,
                recurrence_end_date: task.recurrence_end_date,
                recurrence_weekday: task.recurrence_weekday,
                recurrence_month_day: task.recurrence_month_day,
                recurrence_week_of_month: task.recurrence_week_of_month,
                completion_based: task.completion_based,
                tags: task.Tags
                    ? task.Tags.map((tag) => ({ id: tag.id, name: tag.name }))
                    : [],
            };

            // Handle updating parent recurrence settings if this is a child task
            if (update_parent_recurrence && task.recurring_parent_id) {
                const parentTask = await Task.findOne({
                    where: {
                        id: task.recurring_parent_id,
                        user_id: req.currentUser.id,
                    },
                });

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

            const taskAttributes = {
                name,
                priority:
                    priority !== undefined
                        ? typeof priority === 'string'
                            ? Task.getPriorityValue(priority)
                            : priority
                        : undefined,
                status:
                    status !== undefined
                        ? typeof status === 'string'
                            ? Task.getStatusValue(status)
                            : status
                        : Task.STATUS.NOT_STARTED,
                note,
                due_date: processDueDateForStorage(
                    due_date,
                    getSafeTimezone(req.currentUser.timezone)
                ),
                today: today !== undefined ? today : task.today,
                recurrence_type:
                    recurrence_type !== undefined
                        ? recurrence_type
                        : task.recurrence_type,
                recurrence_interval:
                    recurrence_interval !== undefined
                        ? recurrence_interval
                        : task.recurrence_interval,
                recurrence_end_date:
                    recurrence_end_date !== undefined
                        ? recurrence_end_date
                        : task.recurrence_end_date,
                recurrence_weekday:
                    recurrence_weekday !== undefined
                        ? recurrence_weekday
                        : task.recurrence_weekday,
                recurrence_month_day:
                    recurrence_month_day !== undefined
                        ? recurrence_month_day
                        : task.recurrence_month_day,
                recurrence_week_of_month:
                    recurrence_week_of_month !== undefined
                        ? recurrence_week_of_month
                        : task.recurrence_week_of_month,
                completion_based:
                    completion_based !== undefined
                        ? completion_based
                        : task.completion_based,
            };

            // If task is being moved away from today and has in_progress status, change it to not_started
            if (
                today !== undefined &&
                task.today === true &&
                today === false &&
                task.status === Task.STATUS.IN_PROGRESS
            ) {
                taskAttributes.status = Task.STATUS.NOT_STARTED;
            }

            // Set completed_at when task is marked as done
            if (status !== undefined) {
                const newStatus =
                    typeof status === 'string'
                        ? Task.getStatusValue(status)
                        : status;
                const oldStatus =
                    typeof task.status === 'string'
                        ? Task.getStatusValue(task.status)
                        : task.status;

                if (
                    newStatus === Task.STATUS.DONE &&
                    oldStatus !== Task.STATUS.DONE
                ) {
                    // Task is being completed
                    taskAttributes.completed_at = new Date();
                } else if (
                    newStatus !== Task.STATUS.DONE &&
                    oldStatus === Task.STATUS.DONE
                ) {
                    // Task is being uncompleted
                    taskAttributes.completed_at = null;
                }
            }

            // Handle project assignment
            if (project_id !== undefined) {
                if (project_id && project_id.toString().trim()) {
                    const project = await Project.findOne({
                        where: { id: project_id },
                    });
                    if (!project) {
                        return res
                            .status(400)
                            .json({ error: 'Invalid project.' });
                    }
                    const projectAccess = await permissionsService.getAccess(
                        req.currentUser.id,
                        'project',
                        project.uid
                    );
                    const isOwner = project.user_id === req.currentUser.id;
                    const canWrite =
                        isOwner ||
                        projectAccess === 'rw' ||
                        projectAccess === 'admin';
                    if (!canWrite) {
                        return res.status(403).json({ error: 'Forbidden' });
                    }
                    taskAttributes.project_id = project_id;
                } else {
                    // Only set to null if explicitly provided as null or empty string
                    taskAttributes.project_id = null;
                }
            }
            // If project_id is undefined (not in request body), don't modify it

            // Handle parent task assignment
            if (parent_task_id && parent_task_id.toString().trim()) {
                const parentTask = await Task.findOne({
                    where: { id: parent_task_id, user_id: req.currentUser.id },
                });
                if (!parentTask) {
                    return res
                        .status(400)
                        .json({ error: 'Invalid parent task.' });
                }
                taskAttributes.parent_task_id = parent_task_id;
            } else if (parent_task_id === null || parent_task_id === '') {
                taskAttributes.parent_task_id = null;
            }

            // Check if any recurrence settings are changing and cleanup future instances if needed
            const recurrenceFields = [
                'recurrence_type',
                'recurrence_interval',
                'recurrence_end_date',
                'recurrence_weekday',
                'recurrence_month_day',
                'recurrence_week_of_month',
                'completion_based',
            ];

            const recurrenceChanged = recurrenceFields.some((field) => {
                const newValue = req.body[field];
                return newValue !== undefined && newValue !== task[field];
            });

            // Only cleanup if recurrence changed AND the old task was recurring (not 'none')
            // This prevents cleanup when changing TO 'none' from 'none'
            if (recurrenceChanged && task.recurrence_type !== 'none') {
                // Find child instances of this recurring task
                const childTasks = await Task.findAll({
                    where: { recurring_parent_id: task.id },
                });

                if (childTasks.length > 0) {
                    const now = new Date();

                    // Separate future and past instances
                    const futureInstances = childTasks.filter((child) => {
                        if (!child.due_date) return true; // Tasks without due_date are considered future (not yet scheduled)
                        return new Date(child.due_date) > now;
                    });

                    // Only cleanup future instances if not changing to 'none'
                    const newRecurrenceType =
                        recurrence_type !== undefined
                            ? recurrence_type
                            : task.recurrence_type;
                    if (newRecurrenceType !== 'none') {
                        // Delete future instances since recurrence changed
                        for (const futureInstance of futureInstances) {
                            await futureInstance.destroy();
                        }
                    }

                    // Past instances remain as orphaned instances (no changes needed)
                    // This allows users to keep their completed/in-progress work
                }
            }

            await task.update(taskAttributes);

            // Generate new recurring tasks after updating recurrence settings (if still recurring)
            if (recurrenceChanged && task.recurrence_type !== 'none') {
                const newRecurrenceType =
                    recurrence_type !== undefined
                        ? recurrence_type
                        : task.recurrence_type;
                if (newRecurrenceType !== 'none') {
                    try {
                        // Generate new recurring tasks for the updated pattern
                        await generateRecurringTasks(req.currentUser.id, 7);
                    } catch (error) {
                        logError(
                            'Error generating new recurring tasks after update:',
                            error
                        );
                        // Don't fail the update if regeneration fails
                    }
                }
            }
            await updateTaskTags(task, tagsData, req.currentUser.id);

            // Handle subtasks updates
            if (subtasks && Array.isArray(subtasks)) {
                // Delete existing subtasks that are not in the new list
                const existingSubtasks = await Task.findAll({
                    where: {
                        parent_task_id: task.id,
                        user_id: req.currentUser.id,
                    },
                });

                const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
                const subtasksToDelete = existingSubtasks.filter(
                    (existing) =>
                        !subtasksToKeep.find((keep) => keep.id === existing.id)
                );

                // Delete removed subtasks
                if (subtasksToDelete.length > 0) {
                    await Task.destroy({
                        where: {
                            id: subtasksToDelete.map((s) => s.id),
                            user_id: req.currentUser.id,
                        },
                    });
                }

                // Update edited subtasks and status changes
                const subtasksToUpdate = subtasks.filter(
                    (s) =>
                        s.id &&
                        ((s.isEdited && s.name && s.name.trim()) ||
                            s._statusChanged)
                );
                if (subtasksToUpdate.length > 0) {
                    const updatePromises = subtasksToUpdate.map((subtask) => {
                        const updateData = {};

                        if (
                            subtask.isEdited &&
                            subtask.name &&
                            subtask.name.trim()
                        ) {
                            updateData.name = subtask.name.trim();
                        }

                        if (
                            subtask._statusChanged ||
                            subtask.status !== undefined
                        ) {
                            updateData.status = subtask.status
                                ? typeof subtask.status === 'string'
                                    ? Task.getStatusValue(subtask.status)
                                    : subtask.status
                                : Task.STATUS.NOT_STARTED;

                            if (
                                updateData.status === Task.STATUS.DONE &&
                                !subtask.completed_at
                            ) {
                                updateData.completed_at = new Date();
                            } else if (updateData.status !== Task.STATUS.DONE) {
                                updateData.completed_at = null;
                            }
                        }

                        if (subtask.priority !== undefined) {
                            updateData.priority = subtask.priority
                                ? typeof subtask.priority === 'string'
                                    ? Task.getPriorityValue(subtask.priority)
                                    : subtask.priority
                                : Task.PRIORITY.LOW;
                        }

                        return Task.update(updateData, {
                            where: {
                                id: subtask.id,
                                user_id: req.currentUser.id,
                            },
                        });
                    });

                    await Promise.all(updatePromises);
                }

                // Create new subtasks
                const newSubtasks = subtasks.filter(
                    (s) => s.isNew && s.name && s.name.trim()
                );
                if (newSubtasks.length > 0) {
                    const subtaskPromises = newSubtasks.map((subtask) =>
                        Task.create({
                            name: subtask.name.trim(),
                            parent_task_id: task.id,
                            user_id: req.currentUser.id,
                            priority: subtask.priority
                                ? typeof subtask.priority === 'string'
                                    ? Task.getPriorityValue(subtask.priority)
                                    : subtask.priority
                                : Task.PRIORITY.LOW,
                            status: subtask.status
                                ? typeof subtask.status === 'string'
                                    ? Task.getStatusValue(subtask.status)
                                    : subtask.status
                                : Task.STATUS.NOT_STARTED,
                            completed_at:
                                subtask.status === 'done' ||
                                subtask.status === Task.STATUS.DONE
                                    ? subtask.completed_at
                                        ? new Date(subtask.completed_at)
                                        : new Date()
                                    : null,
                            today: subtask.today || false,
                            recurrence_type: 'none',
                            completion_based: false,
                        })
                    );

                    await Promise.all(subtaskPromises);
                }
            }

            // Log task update events
            try {
                const changes = {};

                // Check for changes in each field
                if (name !== undefined && name !== oldValues.name) {
                    changes.name = { oldValue: oldValues.name, newValue: name };
                }
                if (status !== undefined && status !== oldValues.status) {
                    changes.status = {
                        oldValue: oldValues.status,
                        newValue: status,
                    };
                }
                if (priority !== undefined && priority !== oldValues.priority) {
                    changes.priority = {
                        oldValue: oldValues.priority,
                        newValue: priority,
                    };
                }
                if (due_date !== undefined) {
                    // Normalize dates for comparison (convert to YYYY-MM-DD format)
                    const oldDateStr = oldValues.due_date
                        ? oldValues.due_date.toISOString().split('T')[0]
                        : null;
                    const newDateStr = due_date || null;

                    if (oldDateStr !== newDateStr) {
                        changes.due_date = {
                            oldValue: oldValues.due_date,
                            newValue: due_date,
                        };
                    }
                }
                if (
                    project_id !== undefined &&
                    project_id !== oldValues.project_id
                ) {
                    changes.project_id = {
                        oldValue: oldValues.project_id,
                        newValue: project_id,
                    };
                }
                if (note !== undefined && note !== oldValues.note) {
                    changes.note = { oldValue: oldValues.note, newValue: note };
                }

                // Check recurrence field changes
                if (
                    recurrence_type !== undefined &&
                    recurrence_type !== oldValues.recurrence_type
                ) {
                    changes.recurrence_type = {
                        oldValue: oldValues.recurrence_type,
                        newValue: recurrence_type,
                    };
                }
                if (
                    recurrence_interval !== undefined &&
                    recurrence_interval !== oldValues.recurrence_interval
                ) {
                    changes.recurrence_interval = {
                        oldValue: oldValues.recurrence_interval,
                        newValue: recurrence_interval,
                    };
                }
                if (
                    recurrence_end_date !== undefined &&
                    recurrence_end_date !== oldValues.recurrence_end_date
                ) {
                    changes.recurrence_end_date = {
                        oldValue: oldValues.recurrence_end_date,
                        newValue: recurrence_end_date,
                    };
                }
                if (
                    recurrence_weekday !== undefined &&
                    recurrence_weekday !== oldValues.recurrence_weekday
                ) {
                    changes.recurrence_weekday = {
                        oldValue: oldValues.recurrence_weekday,
                        newValue: recurrence_weekday,
                    };
                }
                if (
                    recurrence_month_day !== undefined &&
                    recurrence_month_day !== oldValues.recurrence_month_day
                ) {
                    changes.recurrence_month_day = {
                        oldValue: oldValues.recurrence_month_day,
                        newValue: recurrence_month_day,
                    };
                }
                if (
                    recurrence_week_of_month !== undefined &&
                    recurrence_week_of_month !==
                        oldValues.recurrence_week_of_month
                ) {
                    changes.recurrence_week_of_month = {
                        oldValue: oldValues.recurrence_week_of_month,
                        newValue: recurrence_week_of_month,
                    };
                }
                if (
                    completion_based !== undefined &&
                    completion_based !== oldValues.completion_based
                ) {
                    changes.completion_based = {
                        oldValue: oldValues.completion_based,
                        newValue: completion_based,
                    };
                }

                // Log all changes
                if (Object.keys(changes).length > 0) {
                    await logTaskUpdate(task.id, req.currentUser.id, changes, {
                        source: 'web',
                    });
                }

                // Check for tag changes (this is more complex due to the array comparison)
                if (tagsData) {
                    const newTags = tagsData.map((tag) => ({
                        id: tag.id,
                        name: tag.name,
                    }));
                    const oldTagNames = oldValues.tags
                        .map((tag) => tag.name)
                        .sort();
                    const newTagNames = newTags.map((tag) => tag.name).sort();

                    if (
                        JSON.stringify(oldTagNames) !==
                        JSON.stringify(newTagNames)
                    ) {
                        await logEvent({
                            taskId: task.id,
                            userId: req.currentUser.id,
                            eventType: 'tags_changed',
                            fieldName: 'tags',
                            oldValue: oldValues.tags,
                            newValue: newTags,
                            metadata: { source: 'web', action: 'tags_update' },
                        });
                    }
                }
            } catch (eventError) {
                logError('Error logging task update events:', eventError);
                // Don't fail the request if event logging fails
            }

            // Reload task with associations
            const taskWithAssociations = await Task.findByPk(task.id, {
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
            });

            // Use serializeTask to include subtasks data
            const serializedTask = await serializeTask(
                taskWithAssociations,
                req.currentUser.timezone,
                { skipDisplayNameTransform: true }
            );

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
    }
);

/**
 * @swagger
 * /api/task/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task deleted successfully."
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.delete(
    '/task/:id',
    hasAccess(
        'rw',
        'task',
        async (req) => {
            const t = await Task.findOne({
                where: { id: req.params.id },
                attributes: ['uid'],
            });
            return t?.uid;
        },
        { notFoundMessage: 'Task not found.' }
    ),
    async (req, res) => {
        try {
            const task = await Task.findOne({
                where: { id: req.params.id },
            });

            if (!task) {
                return res.status(404).json({ error: 'Task not found.' });
            }
            // access ensured by middleware

            // Check for child tasks - prevent deletion of parent tasks with children
            const childTasks = await Task.findAll({
                where: { recurring_parent_id: req.params.id },
            });

            // If this is a recurring parent task with children, prevent deletion
            if (childTasks.length > 0) {
                const now = new Date();

                // Separate past and future instances
                const futureInstances = childTasks.filter((child) => {
                    if (!child.due_date) return true; // Tasks without due_date are considered future (not yet scheduled)
                    return new Date(child.due_date) > now;
                });

                const pastInstances = childTasks.filter((child) => {
                    if (!child.due_date) return false; // Tasks without due_date are considered future, not past
                    return new Date(child.due_date) <= now;
                });

                // Delete future instances
                for (const futureInstance of futureInstances) {
                    await futureInstance.destroy();
                }

                // Orphan past instances (remove parent relationship)
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

            const taskEvents = await TaskEvent.findAll({
                where: { task_id: req.params.id },
            });

            const tagAssociations = await sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags WHERE task_id = ?',
                {
                    replacements: [req.params.id],
                    type: sequelize.QueryTypes.SELECT,
                }
            );

            // Check SQLite foreign key list for tasks table
            const foreignKeys = await sequelize.query(
                'PRAGMA foreign_key_list(tasks)',
                { type: sequelize.QueryTypes.SELECT }
            );

            // Find all tables that reference tasks
            const allTables = await sequelize.query(
                "SELECT name FROM sqlite_master WHERE type='table'",
                { type: sequelize.QueryTypes.SELECT }
            );

            // Whitelist of known valid table names to prevent SQL injection
            const validTableNames = [
                'tasks',
                'projects',
                'notes',
                'users',
                'tags',
                'areas',
                'permissions',
                'actions',
                'task_events',
                'inbox_items',
                'tasks_tags',
                'notes_tags',
                'projects_tags',
                'Sessions',
            ];

            for (const table of allTables) {
                if (
                    table.name !== 'tasks' &&
                    validTableNames.includes(table.name)
                ) {
                    try {
                        const fks = await sequelize.query(
                            `PRAGMA foreign_key_list(${table.name})`,
                            { type: sequelize.QueryTypes.SELECT }
                        );
                        const taskRefs = fks.filter(
                            (fk) => fk.table === 'tasks'
                        );
                        if (taskRefs.length > 0) {
                            // Check if this table has any records referencing our task
                            for (const fk of taskRefs) {
                                const count = await sequelize.query(
                                    `SELECT COUNT(*) as count FROM ${table.name} WHERE ${fk.from} = ?`,
                                    {
                                        replacements: [req.params.id],
                                        type: sequelize.QueryTypes.SELECT,
                                    }
                                );
                            }
                        }
                    } catch (error) {
                        // Skip tables that might not exist or have issues
                    }
                }
            }

            // Temporarily disable foreign key constraints for this operation
            await sequelize.query('PRAGMA foreign_keys = OFF');

            try {
                // Use force delete to bypass foreign key constraints
                await TaskEvent.destroy({
                    where: { task_id: req.params.id },
                    force: true,
                });

                await sequelize.query(
                    'DELETE FROM tasks_tags WHERE task_id = ?',
                    {
                        replacements: [req.params.id],
                    }
                );

                await Task.update(
                    { recurring_parent_id: null },
                    { where: { recurring_parent_id: req.params.id } }
                );

                // Delete the task itself
                await task.destroy({ force: true });
            } finally {
                // Re-enable foreign key constraints
                await sequelize.query('PRAGMA foreign_keys = ON');
            }

            res.json({ message: 'Task successfully deleted' });
        } catch (error) {
            res.status(400).json({
                error: 'There was a problem deleting the task.',
            });
        }
    }
);

module.exports = router;
