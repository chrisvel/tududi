const moment = require('moment-timezone');
const { getSafeTimezone } = require('../../../utils/timezone-utils');
const { sortTasksByOrder } = require('./sorting');

function categorizeTasksByDate(tasks, cutoffDate, safeTimezone) {
    const tasksByDate = new Map();

    tasks.forEach((task) => {
        if (!task.due_date) {
            if (!tasksByDate.has('no-date')) {
                tasksByDate.set('no-date', []);
            }
            tasksByDate.get('no-date').push(task);
            return;
        }

        const taskDueDate = moment.tz(task.due_date, safeTimezone);

        if (taskDueDate.isAfter(cutoffDate)) {
            return;
        }

        const dateKey = taskDueDate.format('YYYY-MM-DD');

        if (!tasksByDate.has(dateKey)) {
            tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey).push(task);
    });

    return tasksByDate;
}

function generateGroupName(dateKey, now, safeTimezone) {
    const dateMoment = moment.tz(dateKey, safeTimezone);
    const dayName = dateMoment.format('dddd');
    const dateDisplay = dateMoment.format('MMMM D');
    const isToday = dateMoment.isSame(now, 'day');
    const isTomorrow = dateMoment.isSame(now.clone().add(1, 'day'), 'day');

    if (isToday) {
        return 'Today';
    } else if (isTomorrow) {
        return 'Tomorrow';
    } else {
        return `${dayName}, ${dateDisplay}`;
    }
}

async function groupTasksByDay(
    tasks,
    userTimezone,
    maxDays = 14,
    orderBy = 'created_at:desc'
) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const now = moment.tz(safeTimezone);
    const cutoffDate = now.clone().add(maxDays, 'days').endOf('day');

    const tasksByDate = categorizeTasksByDate(tasks, cutoffDate, safeTimezone);

    const sortedDates = Array.from(tasksByDate.keys())
        .filter((key) => key !== 'no-date' && key !== 'later')
        .sort();

    const groupedTasks = {};

    sortedDates.forEach((dateKey) => {
        const groupName = generateGroupName(dateKey, now, safeTimezone);
        const tasksForDate = tasksByDate.get(dateKey);
        sortTasksByOrder(tasksForDate, orderBy, safeTimezone);
        groupedTasks[groupName] = tasksForDate;
    });

    if (tasksByDate.has('no-date')) {
        const noDateTasks = tasksByDate.get('no-date');
        sortTasksByOrder(noDateTasks, orderBy, safeTimezone);
        groupedTasks['No Due Date'] = noDateTasks;
    }

    return groupedTasks;
}

module.exports = {
    categorizeTasksByDate,
    generateGroupName,
    groupTasksByDay,
};
