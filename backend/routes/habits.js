const express = require('express');
const router = express.Router();
const { Task, RecurringCompletion } = require('../models');
const habitService = require('../services/habitService');
const { requireAuth } = require('../middleware/auth');

// GET /api/habits - List all habits for current user
router.get('/', requireAuth, async (req, res) => {
    try {
        const habits = await Task.findAll({
            where: {
                user_id: req.currentUser.id,
                habit_mode: true,
                status: { [require('sequelize').Op.ne]: 3 }, // Exclude archived
            },
            order: [['created_at', 'DESC']],
        });

        res.json({ habits });
    } catch (error) {
        console.error('Error fetching habits:', error);
        res.status(500).json({ error: 'Failed to fetch habits' });
    }
});

// POST /api/habits - Create new habit
router.post('/', requireAuth, async (req, res) => {
    try {
        const habitData = {
            ...req.body,
            user_id: req.currentUser.id,
            habit_mode: true,
            status: 0, // NOT_STARTED
        };

        const habit = await Task.create(habitData);
        res.status(201).json({ habit });
    } catch (error) {
        console.error('Error creating habit:', error);
        res.status(500).json({ error: 'Failed to create habit' });
    }
});

// POST /api/habits/:uid/complete - Log completion
router.post('/:uid/complete', requireAuth, async (req, res) => {
    try {
        const habit = await Task.findOne({
            where: { uid: req.params.uid, user_id: req.currentUser.id },
        });

        if (!habit || !habit.habit_mode) {
            return res.status(404).json({ error: 'Habit not found' });
        }

        const { completed_at } = req.body;
        const result = await habitService.logCompletion(
            habit,
            completed_at ? new Date(completed_at) : new Date()
        );

        res.json(result);
    } catch (error) {
        console.error('Error logging completion:', error);
        res.status(500).json({ error: 'Failed to log completion' });
    }
});

// GET /api/habits/:uid/completions - Get habit completions
router.get('/:uid/completions', requireAuth, async (req, res) => {
    try {
        const habit = await Task.findOne({
            where: { uid: req.params.uid, user_id: req.currentUser.id },
        });

        if (!habit || !habit.habit_mode) {
            return res.status(404).json({ error: 'Habit not found' });
        }

        const { start_date, end_date } = req.query;
        const startDate = start_date
            ? new Date(start_date)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = end_date ? new Date(end_date) : new Date();

        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: habit.id,
                skipped: false,
                completed_at: {
                    [require('sequelize').Op.between]: [startDate, endDate],
                },
            },
            order: [['completed_at', 'DESC']],
        });

        res.json({ completions });
    } catch (error) {
        console.error('Error fetching completions:', error);
        res.status(500).json({ error: 'Failed to fetch completions' });
    }
});

// DELETE /api/habits/:uid/completions/:completionId - Delete a specific completion
router.delete(
    '/:uid/completions/:completionId',
    requireAuth,
    async (req, res) => {
        try {
            const habit = await Task.findOne({
                where: { uid: req.params.uid, user_id: req.currentUser.id },
            });

            if (!habit || !habit.habit_mode) {
                return res.status(404).json({ error: 'Habit not found' });
            }

            const completion = await RecurringCompletion.findOne({
                where: {
                    id: req.params.completionId,
                    task_id: habit.id,
                },
            });

            if (!completion) {
                return res.status(404).json({ error: 'Completion not found' });
            }

            await completion.destroy();

            // Recalculate streaks after deletion
            const updates = await habitService.recalculateStreaks(habit);
            await habit.update(updates);

            res.json({ message: 'Completion deleted', task: habit });
        } catch (error) {
            console.error('Error deleting completion:', error);
            res.status(500).json({ error: 'Failed to delete completion' });
        }
    }
);

// GET /api/habits/:uid/stats - Get habit statistics
router.get('/:uid/stats', requireAuth, async (req, res) => {
    try {
        const habit = await Task.findOne({
            where: { uid: req.params.uid, user_id: req.currentUser.id },
        });

        if (!habit || !habit.habit_mode) {
            return res.status(404).json({ error: 'Habit not found' });
        }

        const { start_date, end_date } = req.query;
        const startDate = start_date
            ? new Date(start_date)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = end_date ? new Date(end_date) : new Date();

        const stats = await habitService.getHabitStats(
            habit,
            startDate,
            endDate
        );
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// PUT /api/habits/:uid - Update habit
router.put('/:uid', requireAuth, async (req, res) => {
    try {
        const habit = await Task.findOne({
            where: { uid: req.params.uid, user_id: req.currentUser.id },
        });

        if (!habit || !habit.habit_mode) {
            return res.status(404).json({ error: 'Habit not found' });
        }

        await habit.update(req.body);
        res.json({ habit });
    } catch (error) {
        console.error('Error updating habit:', error);
        res.status(500).json({ error: 'Failed to update habit' });
    }
});

// DELETE /api/habits/:uid - Delete habit
router.delete('/:uid', requireAuth, async (req, res) => {
    try {
        const habit = await Task.findOne({
            where: { uid: req.params.uid, user_id: req.currentUser.id },
        });

        if (!habit || !habit.habit_mode) {
            return res.status(404).json({ error: 'Habit not found' });
        }

        await habit.destroy();
        res.json({ message: 'Habit deleted' });
    } catch (error) {
        console.error('Error deleting habit:', error);
        res.status(500).json({ error: 'Failed to delete habit' });
    }
});

module.exports = router;
