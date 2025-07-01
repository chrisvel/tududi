const { Task } = require('../models');
const { Op } = require('sequelize');

/**
 * Service for managing recurring tasks
 */
class RecurringTaskService {
    /**
     * Generate new tasks from recurring task templates
     * @param {number} userId - Optional user ID to limit processing
     * @returns {Promise<Array>} Array of newly created tasks
     */
    static async generateRecurringTasks(userId = null) {
        try {
            const whereClause = {
                recurrence_type: { [Op.ne]: 'none' },
                status: { [Op.ne]: Task.STATUS.ARCHIVED },
            };

            if (userId) {
                whereClause.user_id = userId;
            }

            // Find all recurring tasks that need processing
            const recurringTasks = await Task.findAll({
                where: whereClause,
                order: [['last_generated_date', 'ASC']],
            });

            const newTasks = [];
            const now = new Date();

            for (const task of recurringTasks) {
                const generatedTasks = await this.processRecurringTask(
                    task,
                    now
                );
                newTasks.push(...generatedTasks);
            }

            return newTasks;
        } catch (error) {
            console.error('Error generating recurring tasks:', error);
            throw error;
        }
    }

    /**
     * Process a single recurring task and generate new instances if needed
     * @param {Object} task - The recurring task template
     * @param {Date} now - Current timestamp
     * @returns {Promise<Array>} Array of newly created task instances
     */
    static async processRecurringTask(task, now) {
        const newTasks = [];

        // Skip if recurrence has ended
        if (task.recurrence_end_date && now > task.recurrence_end_date) {
            return newTasks;
        }

        let nextDueDate = this.calculateNextDueDate(task, now);

        // Generate tasks up to current date
        while (nextDueDate && nextDueDate <= now) {
            // Check if this due date already has a task instance
            const existingTask = await Task.findOne({
                where: {
                    user_id: task.user_id,
                    name: task.name,
                    due_date: nextDueDate,
                    project_id: task.project_id,
                },
            });

            if (!existingTask) {
                const newTask = await this.createTaskInstance(
                    task,
                    nextDueDate
                );
                newTasks.push(newTask);
            }

            // Update last generated date
            task.last_generated_date = nextDueDate;
            await task.save();

            // Calculate next due date
            nextDueDate = this.calculateNextDueDate(task, nextDueDate);

            // Safety check to prevent infinite loops
            if (newTasks.length > 100) {
                console.warn(
                    `Generated 100+ tasks for recurring task ${task.id}, stopping to prevent overflow`
                );
                break;
            }
        }

        return newTasks;
    }

    /**
     * Create a new task instance from a recurring task template
     * @param {Object} template - The recurring task template
     * @param {Date} dueDate - Due date for the new task instance
     * @returns {Promise<Object>} The newly created task
     */
    static async createTaskInstance(template, dueDate) {
        const taskData = {
            name: template.name,
            description: template.description,
            due_date: dueDate,
            today: false,
            priority: template.priority,
            status: Task.STATUS.NOT_STARTED,
            note: template.note,
            user_id: template.user_id,
            project_id: template.project_id,
            recurrence_type: 'none', // Instances are not recurring themselves
            recurring_parent_id: template.id, // Link to the original recurring task
        };

        return await Task.create(taskData);
    }

    /**
     * Calculate the next due date for a recurring task
     * @param {Object} task - The recurring task
     * @param {Date} fromDate - Date to calculate from
     * @returns {Date|null} Next due date or null if no more recurrences
     */
    static calculateNextDueDate(task, fromDate) {
        // Handle invalid inputs
        if (
            !task ||
            !task.recurrence_type ||
            !fromDate ||
            isNaN(fromDate.getTime())
        ) {
            return null;
        }

        const baseDate = task.completion_based
            ? task.last_generated_date || task.created_at
            : task.due_date || task.created_at;

        // If no base date is available, use fromDate
        const startDate = baseDate
            ? new Date(Math.max(fromDate.getTime(), baseDate.getTime()))
            : new Date(fromDate.getTime());

        switch (task.recurrence_type) {
            case 'daily':
                return this.calculateDailyRecurrence(
                    startDate,
                    task.recurrence_interval || 1
                );

            case 'weekly':
                return this.calculateWeeklyRecurrence(
                    startDate,
                    task.recurrence_interval || 1,
                    task.recurrence_weekday
                );

            case 'monthly':
                return this.calculateMonthlyRecurrence(
                    startDate,
                    task.recurrence_interval || 1,
                    task.recurrence_month_day
                );

            case 'monthly_weekday':
                return this.calculateMonthlyWeekdayRecurrence(
                    startDate,
                    task.recurrence_interval || 1,
                    task.recurrence_weekday,
                    task.recurrence_week_of_month
                );

            case 'monthly_last_day':
                return this.calculateMonthlyLastDayRecurrence(
                    startDate,
                    task.recurrence_interval || 1
                );

            default:
                return null;
        }
    }

    /**
     * Calculate next daily recurrence
     * @param {Date} fromDate - Starting date
     * @param {number} interval - Days between recurrences
     * @returns {Date} Next due date
     */
    static calculateDailyRecurrence(fromDate, interval) {
        const nextDate = new Date(fromDate);
        nextDate.setDate(nextDate.getDate() + interval);
        return nextDate;
    }

    /**
     * Calculate next weekly recurrence
     * @param {Date} fromDate - Starting date
     * @param {number} interval - Weeks between recurrences
     * @param {number} weekday - Target day of week (0=Sunday, 6=Saturday)
     * @returns {Date} Next due date
     */
    static calculateWeeklyRecurrence(fromDate, interval, weekday) {
        const nextDate = new Date(fromDate);

        if (weekday !== null && weekday !== undefined) {
            // Find next occurrence of the specified weekday
            const currentWeekday = nextDate.getDay();
            const daysUntilTarget = (weekday - currentWeekday + 7) % 7;

            if (
                daysUntilTarget === 0 &&
                nextDate.getTime() === fromDate.getTime()
            ) {
                // If today is the target weekday and we're calculating from today, add interval weeks
                nextDate.setDate(nextDate.getDate() + interval * 7);
            } else {
                nextDate.setDate(nextDate.getDate() + daysUntilTarget);
                if (nextDate <= fromDate) {
                    nextDate.setDate(nextDate.getDate() + interval * 7);
                }
            }
        } else {
            // No specific weekday, just add interval weeks
            nextDate.setDate(nextDate.getDate() + interval * 7);
        }

        return nextDate;
    }

    /**
     * Calculate next monthly recurrence on specific day
     * @param {Date} fromDate - Starting date
     * @param {number} interval - Months between recurrences
     * @param {number} dayOfMonth - Target day of month (1-31)
     * @returns {Date} Next due date
     */
    static calculateMonthlyRecurrence(fromDate, interval, dayOfMonth) {
        const nextDate = new Date(fromDate);
        const targetDay = dayOfMonth || fromDate.getUTCDate();

        // Move to target month
        const targetMonth = nextDate.getUTCMonth() + interval;
        const targetYear =
            nextDate.getUTCFullYear() + Math.floor(targetMonth / 12);
        const finalMonth = targetMonth % 12;

        // Get the max day for the target month
        const maxDay = new Date(
            Date.UTC(targetYear, finalMonth + 1, 0)
        ).getUTCDate();
        const finalDay = Math.min(targetDay, maxDay);

        // Create the new date
        const result = new Date(
            Date.UTC(
                targetYear,
                finalMonth,
                finalDay,
                fromDate.getUTCHours(),
                fromDate.getUTCMinutes(),
                fromDate.getUTCSeconds(),
                fromDate.getUTCMilliseconds()
            )
        );

        return result;
    }

    /**
     * Calculate next monthly recurrence on specific weekday of month
     * @param {Date} fromDate - Starting date
     * @param {number} interval - Months between recurrences
     * @param {number} weekday - Target weekday (0=Sunday, 6=Saturday)
     * @param {number} weekOfMonth - Which occurrence in month (1-5)
     * @returns {Date} Next due date
     */
    static calculateMonthlyWeekdayRecurrence(
        fromDate,
        interval,
        weekday,
        weekOfMonth
    ) {
        const nextDate = new Date(fromDate);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + interval);

        // Find the first day of the month
        const firstOfMonth = new Date(
            Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), 1)
        );
        const firstWeekday = firstOfMonth.getUTCDay();

        // Calculate the first occurrence of the target weekday
        const daysToAdd = (weekday - firstWeekday + 7) % 7;
        const firstOccurrence = new Date(firstOfMonth);
        firstOccurrence.setUTCDate(1 + daysToAdd);

        // Add weeks to get to the target week of month
        const targetDate = new Date(firstOccurrence);
        targetDate.setUTCDate(
            firstOccurrence.getUTCDate() + (weekOfMonth - 1) * 7
        );

        // Make sure we're still in the same month
        if (targetDate.getUTCMonth() !== nextDate.getUTCMonth()) {
            // Week doesn't exist in this month, use last occurrence
            targetDate.setUTCDate(targetDate.getUTCDate() - 7);
        }

        // Preserve the original time
        targetDate.setUTCHours(
            fromDate.getUTCHours(),
            fromDate.getUTCMinutes(),
            fromDate.getUTCSeconds(),
            fromDate.getUTCMilliseconds()
        );

        return targetDate;
    }

    /**
     * Calculate next monthly recurrence on last day of month
     * @param {Date} fromDate - Starting date
     * @param {number} interval - Months between recurrences
     * @returns {Date} Next due date
     */
    static calculateMonthlyLastDayRecurrence(fromDate, interval) {
        const nextDate = new Date(fromDate);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + interval);

        // Set to last day of month
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1, 0);

        return nextDate;
    }

    /**
     * Helper function to get first weekday of month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
     * @returns {Date} First occurrence of weekday in month
     */
    static _getFirstWeekdayOfMonth(year, month, weekday) {
        const firstOfMonth = new Date(year, month, 1);
        const firstWeekday = firstOfMonth.getDay();
        const daysToAdd = (weekday - firstWeekday + 7) % 7;
        return new Date(year, month, 1 + daysToAdd);
    }

    /**
     * Helper function to get last weekday of month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
     * @returns {Date} Last occurrence of weekday in month
     */
    static _getLastWeekdayOfMonth(year, month, weekday) {
        const lastOfMonth = new Date(year, month + 1, 0);
        const lastWeekday = lastOfMonth.getDay();
        const daysToSubtract = (lastWeekday - weekday + 7) % 7;
        return new Date(year, month, lastOfMonth.getDate() - daysToSubtract);
    }

    /**
     * Helper function to get nth weekday of month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
     * @param {number} n - Which occurrence (1-5)
     * @returns {Date} Nth occurrence of weekday in month
     */
    static _getNthWeekdayOfMonth(year, month, weekday, n) {
        const firstOccurrence = this._getFirstWeekdayOfMonth(
            year,
            month,
            weekday
        );
        const targetDate = new Date(firstOccurrence);
        targetDate.setDate(firstOccurrence.getDate() + (n - 1) * 7);

        // If target date is in next month, return null
        if (targetDate.getMonth() !== month) {
            return null;
        }

        return targetDate;
    }

    /**
     * Helper function to check if next task should be generated
     * @param {Object} task - The recurring task
     * @param {Date} nextDate - Next due date
     * @returns {boolean} Whether to generate next task
     */
    static _shouldGenerateNextTask(task, nextDate) {
        if (!task.recurrence_end_date) {
            return true;
        }
        return nextDate < task.recurrence_end_date;
    }

    /**
     * Handle task completion for recurring tasks
     * @param {Object} task - The completed task
     * @returns {Promise<Object|null>} Next task instance if applicable
     */
    static async handleTaskCompletion(task) {
        // Check if the completed task itself is a recurring task
        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return null;
        }

        // Only generate next task if completion_based is true
        if (!task.completion_based) {
            return null;
        }

        // Update the task's last generated date to completion date
        task.last_generated_date = new Date();
        await task.save();

        // For completion-based tasks, create the next instance immediately
        const nextDueDate = this.calculateNextDueDate(task, new Date());

        if (!nextDueDate) {
            return null;
        }

        // Check if this due date already has a task instance
        const whereClause = {
            user_id: task.user_id,
            name: task.name,
            due_date: nextDueDate,
        };

        // Only add project_id to where clause if it's not null/undefined
        if (task.project_id !== null && task.project_id !== undefined) {
            whereClause.project_id = task.project_id;
        } else {
            whereClause.project_id = null;
        }

        const existingTask = await Task.findOne({
            where: whereClause,
        });

        if (existingTask) {
            return null; // Task already exists for this date
        }

        // Create the next task instance
        const nextTask = await this.createTaskInstance(task, nextDueDate);
        return nextTask;
    }
}

module.exports = RecurringTaskService;
