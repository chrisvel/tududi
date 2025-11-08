const express = require('express');
const router = express.Router();
const { Task, Tag, Project } = require('../../models');
const { hasAccess } = require('../../middleware/authorize');
const { handleTaskCompletion } = require('../../services/recurringTaskService');
const { logEvent } = require('../../services/taskEventService');
const { logError } = require('../../services/logService');
const {
    serializeTask,
    checkAndUpdateParentTaskCompletion,
    undoneParentTaskIfNeeded,
    completeAllSubtasks,
    undoneAllSubtasks,
} = require('./helpers');

// PATCH /api/task/:id/toggle_completion
router.patch(
    '/task/:id/toggle_completion',
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
            // access ensured by middleware

            // Track if parent-child logic was executed
            let parentChildLogicExecuted = false;

            const newStatus =
                task.status === Task.STATUS.DONE || task.status === 'done'
                    ? task.note
                        ? Task.STATUS.IN_PROGRESS
                        : Task.STATUS.NOT_STARTED
                    : Task.STATUS.DONE;

            // Set completed_at when task is completed/uncompleted
            const updateData = { status: newStatus };
            if (newStatus === Task.STATUS.DONE) {
                updateData.completed_at = new Date();
            } else if (
                task.status === Task.STATUS.DONE ||
                task.status === 'done'
            ) {
                updateData.completed_at = null;
            }

            await task.update(updateData);

            // Check if subtasks exist in database directly to debug association issue
            const directSubtasksQuery = await Task.findAll({
                where: {
                    parent_task_id: task.id,
                    user_id: req.currentUser.id,
                },
                attributes: ['id', 'name', 'status', 'parent_task_id'],
            });

            // If direct query finds subtasks but task.Subtasks is empty, there's an association issue
            if (
                directSubtasksQuery.length > 0 &&
                (!task.Subtasks || task.Subtasks.length === 0)
            ) {
                task.Subtasks = directSubtasksQuery;
            }

            if (task.parent_task_id) {
                if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
                    // When subtask is done, check if parent should be done
                    const parentUpdated =
                        await checkAndUpdateParentTaskCompletion(
                            task.parent_task_id,
                            req.currentUser.id
                        );
                    if (parentUpdated) {
                        parentChildLogicExecuted = true;
                    }
                } else {
                    // When subtask is undone, undone parent if it was done
                    const parentUpdated = await undoneParentTaskIfNeeded(
                        task.parent_task_id,
                        req.currentUser.id
                    );
                    if (parentUpdated) {
                        parentChildLogicExecuted = true;
                    }
                }
            } else if (task.Subtasks && task.Subtasks.length > 0) {
                // This is a parent task with subtasks
                if (newStatus === Task.STATUS.DONE) {
                    // When parent is done, complete all subtasks
                    const subtasksUpdated = await completeAllSubtasks(
                        task.id,
                        req.currentUser.id
                    );
                    if (subtasksUpdated) {
                        parentChildLogicExecuted = true;
                    }
                } else {
                    // When parent is undone, undone all subtasks
                    const subtasksUpdated = await undoneAllSubtasks(
                        task.id,
                        req.currentUser.id
                    );
                    if (subtasksUpdated) {
                        parentChildLogicExecuted = true;
                    }
                }
            }

            // Handle recurring task completion
            let nextTask = null;
            if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
                nextTask = await handleTaskCompletion(task);
            }

            // Use serializeTask to include subtasks data
            const response = await serializeTask(
                task,
                req.currentUser.timezone
            );

            // If parent-child logic was executed, we might need to reload data
            // For now, let the frontend handle the refresh to avoid complex reloading logic

            if (nextTask) {
                response.next_task = {
                    ...nextTask.toJSON(),
                    due_date: nextTask.due_date
                        ? nextTask.due_date.toISOString().split('T')[0]
                        : null,
                };
            }

            // Add flag to response to indicate if parent-child logic was executed
            response.parent_child_logic_executed = parentChildLogicExecuted;

            res.json(response);
        } catch (error) {
            logError('Error in toggle completion endpoint:', error);
            logError('Error stack:', error.stack);
            res.status(422).json({
                error: 'Unable to update task',
                details: error.message,
            });
        }
    }
);

// PATCH /api/task/:id/toggle-today
router.patch(
    '/task/:id/toggle-today',
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

            if (!task) {
                return res.status(404).json({ error: 'Task not found.' });
            }

            // access ensured by middleware

            // Toggle the today flag
            const newTodayValue = !task.today;
            const updateData = { today: newTodayValue };

            // If task is being moved away from today and has in_progress status, change it to not_started
            if (
                task.today === true &&
                newTodayValue === false &&
                task.status === Task.STATUS.IN_PROGRESS
            ) {
                updateData.status = Task.STATUS.NOT_STARTED;
            }
            await task.update(updateData);

            // Log the change
            try {
                await logEvent({
                    taskId: task.id,
                    userId: req.currentUser.id,
                    eventType: 'today_changed',
                    fieldName: 'today',
                    oldValue: !newTodayValue,
                    newValue: newTodayValue,
                    metadata: { source: 'web', action: 'toggle_today' },
                });
            } catch (eventError) {
                logError('Error logging today toggle event:', eventError);
                // Don't fail the request if event logging fails
            }

            // Use serializeTask helper to ensure consistent response format including tags
            const serializedTask = await serializeTask(
                task,
                req.currentUser.timezone
            );
            res.json(serializedTask);
        } catch (error) {
            logError('Error toggling task today flag:', error);
            res.status(500).json({ error: 'Failed to update task today flag' });
        }
    }
);

module.exports = router;
