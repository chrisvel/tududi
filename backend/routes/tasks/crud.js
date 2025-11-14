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

function parsePriority(priority) {
    if (priority === undefined) return null;
    return typeof priority === 'string'
        ? Task.getPriorityValue(priority)
        : priority;
}

function parseStatus(status, defaultStatus = Task.STATUS.NOT_STARTED) {
    if (status === undefined) return defaultStatus;
    return typeof status === 'string' ? Task.getStatusValue(status) : status;
}

async function validateProjectAccess(projectId, userId) {
    if (!projectId || !projectId.toString().trim()) {
        return null;
    }

    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) {
        throw new Error('Invalid project.');
    }

    const projectAccess = await permissionsService.getAccess(
        userId,
        'project',
        project.uid
    );
    const isOwner = project.user_id === userId;
    const canWrite =
        isOwner || projectAccess === 'rw' || projectAccess === 'admin';

    if (!canWrite) {
        throw new Error('Forbidden');
    }

    return projectId;
}

async function validateParentTaskAccess(parentTaskId, userId) {
    if (!parentTaskId || !parentTaskId.toString().trim()) {
        return null;
    }

    const parentTask = await Task.findOne({
        where: { id: parentTaskId, user_id: userId },
    });
    if (!parentTask) {
        throw new Error('Invalid parent task.');
    }

    const parentAccess = await permissionsService.getAccess(
        userId,
        'task',
        parentTask.uid
    );
    const isOwner = parentTask.user_id === userId;
    const canWrite =
        isOwner || parentAccess === 'rw' || parentAccess === 'admin';

    if (!canWrite) {
        throw new Error('Invalid parent task.');
    }

    return parentTaskId;
}

function buildTaskAttributes(body, userId, timezone, isUpdate = false) {
    const attrs = {
        name: body.name?.trim(),
        priority: parsePriority(body.priority),
        due_date: processDueDateForStorage(body.due_date, timezone),
        status: parseStatus(body.status),
        note: body.note,
        today: body.today !== undefined ? body.today : false,
        recurrence_type: body.recurrence_type || 'none',
        recurrence_interval: body.recurrence_interval || null,
        recurrence_end_date: body.recurrence_end_date || null,
        recurrence_weekday:
            body.recurrence_weekday !== undefined
                ? body.recurrence_weekday
                : null,
        recurrence_month_day:
            body.recurrence_month_day !== undefined
                ? body.recurrence_month_day
                : null,
        recurrence_week_of_month:
            body.recurrence_week_of_month !== undefined
                ? body.recurrence_week_of_month
                : null,
        completion_based: body.completion_based || false,
    };

    if (!isUpdate) {
        attrs.user_id = userId;
    }

    return attrs;
}

function buildUpdateAttributes(body, task, timezone) {
    return {
        name: body.name,
        priority:
            body.priority !== undefined
                ? parsePriority(body.priority)
                : undefined,
        status:
            body.status !== undefined
                ? parseStatus(body.status)
                : Task.STATUS.NOT_STARTED,
        note: body.note,
        due_date: processDueDateForStorage(body.due_date, timezone),
        today: body.today !== undefined ? body.today : task.today,
        recurrence_type:
            body.recurrence_type !== undefined
                ? body.recurrence_type
                : task.recurrence_type,
        recurrence_interval:
            body.recurrence_interval !== undefined
                ? body.recurrence_interval
                : task.recurrence_interval,
        recurrence_end_date:
            body.recurrence_end_date !== undefined
                ? body.recurrence_end_date
                : task.recurrence_end_date,
        recurrence_weekday:
            body.recurrence_weekday !== undefined
                ? body.recurrence_weekday
                : task.recurrence_weekday,
        recurrence_month_day:
            body.recurrence_month_day !== undefined
                ? body.recurrence_month_day
                : task.recurrence_month_day,
        recurrence_week_of_month:
            body.recurrence_week_of_month !== undefined
                ? body.recurrence_week_of_month
                : task.recurrence_week_of_month,
        completion_based:
            body.completion_based !== undefined
                ? body.completion_based
                : task.completion_based,
    };
}

async function createSubtasks(parentTaskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const subtaskPromises = subtasks
        .filter((subtask) => subtask.name && subtask.name.trim())
        .map((subtask) =>
            Task.create({
                name: subtask.name.trim(),
                parent_task_id: parentTaskId,
                user_id: userId,
                priority: parsePriority(subtask.priority) || Task.PRIORITY.LOW,
                status: parseStatus(subtask.status),
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

const TASK_INCLUDES = [
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
];

const TASK_INCLUDES_WITH_SUBTASKS = [
    ...TASK_INCLUDES,
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
];

function captureOldValues(task) {
    return {
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
}

async function handleCompletionStatus(taskAttributes, status, task) {
    if (status === undefined) return;

    const newStatus = parseStatus(status);
    const oldStatus = parseStatus(task.status);

    if (newStatus === Task.STATUS.DONE && oldStatus !== Task.STATUS.DONE) {
        taskAttributes.completed_at = new Date();
    } else if (
        newStatus !== Task.STATUS.DONE &&
        oldStatus === Task.STATUS.DONE
    ) {
        taskAttributes.completed_at = null;
    }
}

async function handleRecurrenceUpdate(task, recurrenceFields, reqBody, userId) {
    const recurrenceChanged = recurrenceFields.some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    if (!recurrenceChanged || task.recurrence_type === 'none') {
        return false;
    }

    const childTasks = await Task.findAll({
        where: { recurring_parent_id: task.id },
    });

    if (childTasks.length > 0) {
        const now = new Date();
        const futureInstances = childTasks.filter((child) => {
            if (!child.due_date) return true;
            return new Date(child.due_date) > now;
        });

        const newRecurrenceType =
            reqBody.recurrence_type !== undefined
                ? reqBody.recurrence_type
                : task.recurrence_type;

        if (newRecurrenceType !== 'none') {
            for (const futureInstance of futureInstances) {
                await futureInstance.destroy();
            }
        }
    }

    return recurrenceChanged;
}

async function updateSubtasks(taskId, subtasks, userId, serializationOptions) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const existingSubtasks = await Task.findAll({
        where: { parent_task_id: taskId, user_id: userId },
    });

    const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
    const subtasksToDelete = existingSubtasks.filter(
        (existing) => !subtasksToKeep.find((keep) => keep.id === existing.id)
    );

    if (subtasksToDelete.length > 0) {
        await Task.destroy({
            where: {
                id: subtasksToDelete.map((s) => s.id),
                user_id: userId,
            },
        });
    }

    const subtasksToUpdate = subtasks.filter(
        (s) =>
            s.id &&
            ((s.isEdited && s.name && s.name.trim()) || s._statusChanged)
    );

    if (subtasksToUpdate.length > 0) {
        const updatePromises = subtasksToUpdate.map((subtask) => {
            const updateData = {};

            if (subtask.isEdited && subtask.name && subtask.name.trim()) {
                updateData.name = subtask.name.trim();
            }

            if (subtask._statusChanged || subtask.status !== undefined) {
                updateData.status = parseStatus(subtask.status);

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
                updateData.priority =
                    parsePriority(subtask.priority) || Task.PRIORITY.LOW;
            }

            return Task.update(updateData, {
                where: { id: subtask.id, user_id: userId },
            });
        });

        await Promise.all(updatePromises);
    }

    const newSubtasks = subtasks.filter(
        (s) => s.isNew && s.name && s.name.trim()
    );

    if (newSubtasks.length > 0) {
        await createSubtasks(taskId, newSubtasks, userId);
    }
}

async function logTaskChanges(task, oldValues, reqBody, tagsData, userId) {
    try {
        const changes = {};
        const fields = [
            'name',
            'status',
            'priority',
            'project_id',
            'note',
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        fields.forEach((field) => {
            if (
                reqBody[field] !== undefined &&
                reqBody[field] !== oldValues[field]
            ) {
                changes[field] = {
                    oldValue: oldValues[field],
                    newValue: reqBody[field],
                };
            }
        });

        if (reqBody.due_date !== undefined) {
            const oldDateStr = oldValues.due_date
                ? oldValues.due_date.toISOString().split('T')[0]
                : null;
            const newDateStr = reqBody.due_date || null;

            if (oldDateStr !== newDateStr) {
                changes.due_date = {
                    oldValue: oldValues.due_date,
                    newValue: reqBody.due_date,
                };
            }
        }

        if (Object.keys(changes).length > 0) {
            await logTaskUpdate(task.id, userId, changes, { source: 'web' });
        }

        if (tagsData) {
            const newTags = tagsData.map((tag) => ({
                id: tag.id,
                name: tag.name,
            }));
            const oldTagNames = oldValues.tags.map((tag) => tag.name).sort();
            const newTagNames = newTags.map((tag) => tag.name).sort();

            if (JSON.stringify(oldTagNames) !== JSON.stringify(newTagNames)) {
                await logEvent({
                    taskId: task.id,
                    userId: userId,
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
    }
}

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

        const task = await Task.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);
        await createSubtasks(task.id, subtasks, req.currentUser.id);

        const taskWithAssociations = await Task.findByPk(task.id, {
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

router.get(
    '/task/:uid',
    hasAccess(
        'ro',
        'task',
        async (req) => {
            return req.params.uid;
        },
        { notFoundMessage: 'Task not found.' }
    ),
    async (req, res) => {
        try {
            const task = await Task.findOne({
                where: { uid: req.params.uid },
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
    }
);

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

            const tagsData = tags || Tags;

            const task = await Task.findOne({
                where: { id: req.params.id },
                include: TASK_INCLUDES,
            });

            if (!task) {
                return res.status(404).json({ error: 'Task not found.' });
            }

            const oldValues = captureOldValues(task);

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

            const timezone = getSafeTimezone(req.currentUser.timezone);
            const taskAttributes = buildUpdateAttributes(
                req.body,
                task,
                timezone
            );

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
                'recurrence_month_day',
                'recurrence_week_of_month',
                'completion_based',
            ];

            const recurrenceChanged = await handleRecurrenceUpdate(
                task,
                recurrenceFields,
                req.body,
                req.currentUser.id
            );

            await task.update(taskAttributes);

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

            const taskWithAssociations = await Task.findByPk(task.id, {
                include: TASK_INCLUDES,
            });

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

            const childTasks = await Task.findAll({
                where: { recurring_parent_id: req.params.id },
            });

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

            const foreignKeys = await sequelize.query(
                'PRAGMA foreign_key_list(tasks)',
                { type: sequelize.QueryTypes.SELECT }
            );

            const allTables = await sequelize.query(
                "SELECT name FROM sqlite_master WHERE type='table'",
                { type: sequelize.QueryTypes.SELECT }
            );

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
                    } catch (error) {}
                }
            }

            await sequelize.query('PRAGMA foreign_keys = OFF');

            try {
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
    }
);

module.exports = router;
