const express = require('express');
const router = express.Router();
const { Task } = require('../../models');
const {
    generateRecurringTasks,
    calculateNextDueDate,
} = require('../../services/recurringTaskService');
const {
    processDueDateForResponse,
    getSafeTimezone,
} = require('../../utils/timezone-utils');
const { logError } = require('../../services/logService');

// POST /api/tasks/generate-recurring
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

// GET /api/task/:id/next-iterations
router.get('/task/:id/next-iterations', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        // Find the task
        const task = await Task.findOne({
            where: {
                id: taskId,
                user_id: req.currentUser.id,
            },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if task has recurrence
        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return res.json({ iterations: [] });
        }

        // Calculate next 5 iteration dates
        const iterations = [];

        // Allow starting from a specific date (for child tasks) or default to today
        const startFromDate = req.query.startFromDate;
        const startDate = startFromDate ? new Date(startFromDate) : new Date();
        startDate.setUTCHours(0, 0, 0, 0);

        // Calculate next iteration directly using recurrence logic
        let nextDate = new Date(startDate);

        // For daily recurrence, start from the next day after startDate
        if (task.recurrence_type === 'daily') {
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            // For weekly, find next occurrence of the target weekday
            const interval = task.recurrence_interval || 1;
            if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
                const currentWeekday = nextDate.getDay();
                const daysUntilTarget =
                    (task.recurrence_weekday - currentWeekday + 7) % 7;
                if (daysUntilTarget === 0) {
                    // If startDate is the target weekday, move to next week
                    nextDate.setDate(nextDate.getDate() + interval * 7);
                } else {
                    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
                }
            } else {
                nextDate.setDate(nextDate.getDate() + interval * 7);
            }
        } else {
            // For other types, use the RecurringTaskService method but calculate from startDate
            nextDate = calculateNextDueDate(task, startDate);
        }

        for (let i = 0; i < 5 && nextDate; i++) {
            // Check if recurrence has an end date and we've exceeded it
            if (task.recurrence_end_date) {
                const endDate = new Date(task.recurrence_end_date);
                if (nextDate > endDate) {
                    break;
                }
            }

            iterations.push({
                date: processDueDateForResponse(
                    nextDate,
                    getSafeTimezone(req.currentUser.timezone)
                ),
                utc_date: nextDate.toISOString(),
            });

            // Calculate the next iteration by adding the interval
            if (task.recurrence_type === 'daily') {
                nextDate = new Date(nextDate);
                nextDate.setDate(
                    nextDate.getDate() + (task.recurrence_interval || 1)
                );
            } else if (task.recurrence_type === 'weekly') {
                nextDate = new Date(nextDate);
                nextDate.setDate(
                    nextDate.getDate() + (task.recurrence_interval || 1) * 7
                );
            } else {
                // For monthly and other complex recurrences, use the service method
                nextDate = calculateNextDueDate(task, nextDate);
            }
        }

        res.json({ iterations });
    } catch (error) {
        logError('Error getting next iterations:', error);
        res.status(500).json({ error: 'Failed to get next iterations' });
    }
});

module.exports = router;
