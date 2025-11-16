const { Task, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const taskRepository = require('../repositories/TaskRepository');

const generationLocks = new Map();

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const generateRecurringTasksWithLock = async (userId, lookAheadDays = 7) => {
    const lockKey = `user_${userId}`;

    if (generationLocks.get(lockKey)) {
        return [];
    }

    try {
        generationLocks.set(lockKey, true);
        return await generateRecurringTasks(userId, lookAheadDays);
    } catch (error) {
        logError('Error generating recurring tasks with lock:', error);
        throw error;
    } finally {
        generationLocks.delete(lockKey);
    }
};

const generateRecurringTasks = async (userId = null, lookAheadDays = 7) => {
    try {
        const whereClause = {
            recurrence_type: { [Op.ne]: 'none' },
            status: { [Op.ne]: Task.STATUS.ARCHIVED },
        };

        if (userId) {
            whereClause.user_id = userId;
        }

        const recurringTasks = await Task.findAll({
            where: whereClause,
            order: [['last_generated_date', 'ASC']],
        });

        const newTasks = [];
        const now = new Date();
        const lookAheadDate = addDays(now, lookAheadDays);

        for (const task of recurringTasks) {
            const generatedTasks = await processRecurringTask(
                task,
                now,
                lookAheadDate
            );
            newTasks.push(...generatedTasks);
        }

        return newTasks;
    } catch (error) {
        console.error('Error generating recurring tasks:', error);
        throw error;
    }
};

const processRecurringTask = async (task, now, lookAheadDate = null) => {
    const newTasks = [];
    const generateUpTo = lookAheadDate || now;

    if (task.recurrence_end_date && now > task.recurrence_end_date) {
        return newTasks;
    }

    if (!task.last_generated_date) {
        const originalDueDate = task.due_date
            ? new Date(task.due_date.getTime())
            : new Date(now.getTime());

        if (originalDueDate <= generateUpTo) {
            const startOfDay = new Date(originalDueDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(originalDueDate);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const whereClause = {
                user_id: task.user_id,
                recurring_parent_id: task.id,
                due_date: {
                    [Op.between]: [startOfDay, endOfDay],
                },
            };

            if (task.project_id !== null && task.project_id !== undefined) {
                whereClause.project_id = task.project_id;
            } else {
                whereClause.project_id = null;
            }

            const existingTask = await Task.findOne({
                where: whereClause,
            });

            if (!existingTask) {
                const newTask = await createTaskInstance(task, originalDueDate);
                newTasks.push(newTask);
            }

            if (originalDueDate <= now) {
                task.last_generated_date = originalDueDate;
                await task.save();
            }
        }
    }

    let nextDueDate = calculateNextDueDate(
        task,
        task.last_generated_date || task.due_date || now
    );

    while (nextDueDate && nextDueDate <= generateUpTo) {
        const startOfDay = new Date(nextDueDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(nextDueDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const whereClause = {
            user_id: task.user_id,
            recurring_parent_id: task.id,
            due_date: {
                [Op.between]: [startOfDay, endOfDay],
            },
        };

        if (task.project_id !== null && task.project_id !== undefined) {
            whereClause.project_id = task.project_id;
        } else {
            whereClause.project_id = null;
        }

        const result = await sequelize.transaction(async (transaction) => {
            const existingTask = await Task.findOne({
                where: whereClause,
                transaction,
            });

            if (existingTask) {
                return null;
            }

            return await createTaskInstance(task, nextDueDate, transaction);
        });

        if (result) {
            newTasks.push(result);
        }

        if (nextDueDate <= now) {
            task.last_generated_date = nextDueDate;
            await task.save();
        }

        nextDueDate = calculateNextDueDate(task, nextDueDate);

        if (newTasks.length > 100) {
            console.warn(
                `Generated 100+ tasks for recurring task ${task.id}, stopping to prevent overflow`
            );
            break;
        }
    }

    return newTasks;
};

const createTaskInstance = async (template, dueDate, transaction = null) => {
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
        recurrence_type: 'none',
        recurring_parent_id: template.id,
    };

    const options = {};
    if (transaction) {
        options.transaction = transaction;
    }

    const newTask = await Task.create(taskData, options);

    const subtasks = await taskRepository.findChildren(
        template.id,
        template.user_id
    );

    if (subtasks && subtasks.length > 0) {
        const subtasksData = subtasks.map((subtask) => ({
            name: subtask.name,
            description: subtask.description,
            parent_task_id: newTask.id,
            user_id: template.user_id,
            priority: subtask.priority,
            status: Task.STATUS.NOT_STARTED,
            note: subtask.note,
            today: false,
            recurrence_type: 'none',
            completion_based: false,
        }));

        if (transaction) {
            await Promise.all(
                subtasksData.map((subtaskData) =>
                    Task.create(subtaskData, { transaction })
                )
            );
        } else {
            await taskRepository.createMany(subtasksData);
        }
    }

    return newTask;
};

const calculateNextDueDate = (task, fromDate) => {
    if (
        !task ||
        !task.recurrence_type ||
        !fromDate ||
        isNaN(fromDate.getTime())
    ) {
        return null;
    }

    const startDate = new Date(fromDate.getTime());

    switch (task.recurrence_type) {
        case 'daily':
            return calculateDailyRecurrence(
                startDate,
                task.recurrence_interval || 1
            );

        case 'weekly':
            return calculateWeeklyRecurrence(
                startDate,
                task.recurrence_interval || 1,
                task.recurrence_weekday
            );

        case 'monthly':
            return calculateMonthlyRecurrence(
                startDate,
                task.recurrence_interval || 1,
                task.recurrence_month_day
            );

        case 'monthly_weekday':
            return calculateMonthlyWeekdayRecurrence(
                startDate,
                task.recurrence_interval || 1,
                task.recurrence_weekday,
                task.recurrence_week_of_month
            );

        case 'monthly_last_day':
            return calculateMonthlyLastDayRecurrence(
                startDate,
                task.recurrence_interval || 1
            );

        default:
            return null;
    }
};

const calculateDailyRecurrence = (fromDate, interval) => {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + interval);
    return nextDate;
};

const calculateWeeklyRecurrence = (fromDate, interval, weekday) => {
    const nextDate = new Date(fromDate);

    if (weekday !== null && weekday !== undefined) {
        const currentWeekday = nextDate.getDay();
        const daysUntilTarget = (weekday - currentWeekday + 7) % 7;

        if (
            daysUntilTarget === 0 &&
            nextDate.getTime() === fromDate.getTime()
        ) {
            nextDate.setDate(nextDate.getDate() + interval * 7);
        } else {
            nextDate.setDate(nextDate.getDate() + daysUntilTarget);
            if (nextDate <= fromDate) {
                nextDate.setDate(nextDate.getDate() + interval * 7);
            }
        }
    } else {
        nextDate.setDate(nextDate.getDate() + interval * 7);
    }

    return nextDate;
};

const calculateMonthlyRecurrence = (fromDate, interval, dayOfMonth) => {
    const nextDate = new Date(fromDate);
    const targetDay = dayOfMonth || fromDate.getUTCDate();

    const targetMonth = nextDate.getUTCMonth() + interval;
    const targetYear = nextDate.getUTCFullYear() + Math.floor(targetMonth / 12);
    const finalMonth = targetMonth % 12;

    const maxDay = new Date(
        Date.UTC(targetYear, finalMonth + 1, 0)
    ).getUTCDate();
    const finalDay = Math.min(targetDay, maxDay);

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
};

const calculateMonthlyWeekdayRecurrence = (
    fromDate,
    interval,
    weekday,
    weekOfMonth
) => {
    const nextDate = new Date(fromDate);
    nextDate.setUTCMonth(nextDate.getUTCMonth() + interval);

    const firstOfMonth = new Date(
        Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), 1)
    );
    const firstWeekday = firstOfMonth.getUTCDay();

    const daysToAdd = (weekday - firstWeekday + 7) % 7;
    const firstOccurrence = new Date(firstOfMonth);
    firstOccurrence.setUTCDate(1 + daysToAdd);

    const targetDate = new Date(firstOccurrence);
    targetDate.setUTCDate(firstOccurrence.getUTCDate() + (weekOfMonth - 1) * 7);

    if (targetDate.getUTCMonth() !== nextDate.getUTCMonth()) {
        targetDate.setUTCDate(targetDate.getUTCDate() - 7);
    }

    targetDate.setUTCHours(
        fromDate.getUTCHours(),
        fromDate.getUTCMinutes(),
        fromDate.getUTCSeconds(),
        fromDate.getUTCMilliseconds()
    );

    return targetDate;
};

const calculateMonthlyLastDayRecurrence = (fromDate, interval) => {
    const nextDate = new Date(fromDate);
    nextDate.setUTCMonth(nextDate.getUTCMonth() + interval);

    nextDate.setUTCMonth(nextDate.getUTCMonth() + 1, 0);

    return nextDate;
};

const getFirstWeekdayOfMonth = (year, month, weekday) => {
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = firstOfMonth.getDay();
    const daysToAdd = (weekday - firstWeekday + 7) % 7;
    return new Date(year, month, 1 + daysToAdd);
};

const getLastWeekdayOfMonth = (year, month, weekday) => {
    const lastOfMonth = new Date(year, month + 1, 0);
    const lastWeekday = lastOfMonth.getDay();
    const daysToSubtract = (lastWeekday - weekday + 7) % 7;
    return new Date(year, month, lastOfMonth.getDate() - daysToSubtract);
};

const getNthWeekdayOfMonth = (year, month, weekday, n) => {
    const firstOccurrence = getFirstWeekdayOfMonth(year, month, weekday);
    const targetDate = new Date(firstOccurrence);
    targetDate.setDate(firstOccurrence.getDate() + (n - 1) * 7);

    if (targetDate.getMonth() !== month) {
        return null;
    }

    return targetDate;
};

const shouldGenerateNextTask = (task, nextDate) => {
    if (!task.recurrence_end_date) {
        return true;
    }
    return nextDate < task.recurrence_end_date;
};

const handleTaskCompletion = async (task) => {
    if (!task.recurrence_type || task.recurrence_type === 'none') {
        return null;
    }

    if (!task.completion_based) {
        return null;
    }

    task.last_generated_date = new Date();
    await task.save();

    const nextDueDate = calculateNextDueDate(task, new Date());

    if (!nextDueDate) {
        return null;
    }

    const startOfDay = new Date(nextDueDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(nextDueDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const whereClause = {
        user_id: task.user_id,
        recurring_parent_id: task.id,
        due_date: {
            [Op.between]: [startOfDay, endOfDay],
        },
    };

    if (task.project_id !== null && task.project_id !== undefined) {
        whereClause.project_id = task.project_id;
    } else {
        whereClause.project_id = null;
    }

    const existingTask = await Task.findOne({
        where: whereClause,
    });

    if (existingTask) {
        return null;
    }

    const nextTask = await createTaskInstance(task, nextDueDate);
    return nextTask;
};

module.exports = {
    generateRecurringTasks,
    generateRecurringTasksWithLock,
    processRecurringTask,
    createTaskInstance,
    calculateNextDueDate,
    calculateDailyRecurrence,
    calculateWeeklyRecurrence,
    calculateMonthlyRecurrence,
    calculateMonthlyWeekdayRecurrence,
    calculateMonthlyLastDayRecurrence,
    handleTaskCompletion,
    shouldGenerateNextTask,
    getFirstWeekdayOfMonth,
    getLastWeekdayOfMonth,
    getNthWeekdayOfMonth,
    _getFirstWeekdayOfMonth: getFirstWeekdayOfMonth,
    _getLastWeekdayOfMonth: getLastWeekdayOfMonth,
    _getNthWeekdayOfMonth: getNthWeekdayOfMonth,
    _shouldGenerateNextTask: shouldGenerateNextTask,
};
