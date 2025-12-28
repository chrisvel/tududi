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
    nextDate.setUTCDate(nextDate.getUTCDate() + interval);
    return nextDate;
};

const calculateWeeklyRecurrence = (fromDate, interval, weekday) => {
    const nextDate = new Date(fromDate);

    if (weekday !== null && weekday !== undefined) {
        const currentWeekday = nextDate.getUTCDay();
        const daysUntilTarget = (weekday - currentWeekday + 7) % 7;

        if (
            daysUntilTarget === 0 &&
            nextDate.getTime() === fromDate.getTime()
        ) {
            nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
        } else {
            nextDate.setUTCDate(nextDate.getUTCDate() + daysUntilTarget);
            if (nextDate <= fromDate) {
                nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
            }
        }
    } else {
        nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
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
    // Calculate target year and month directly to avoid date overflow
    // (e.g., Jan 31 + 1 month via setUTCMonth would overflow to March)
    const currentMonth = fromDate.getUTCMonth();
    const currentYear = fromDate.getUTCFullYear();

    const totalMonths = currentMonth + interval;
    const targetYear = currentYear + Math.floor(totalMonths / 12);
    const targetMonth = totalMonths % 12;

    // Get last day of target month by creating date at day 0 of following month
    const lastDayOfMonth = new Date(
        Date.UTC(
            targetYear,
            targetMonth + 1, // next month
            0, // day 0 = last day of previous month
            fromDate.getUTCHours(),
            fromDate.getUTCMinutes(),
            fromDate.getUTCSeconds(),
            fromDate.getUTCMilliseconds()
        )
    );

    return lastDayOfMonth;
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

const calculateVirtualOccurrences = (task, count = 7, startFrom = null) => {
    const occurrences = [];
    let currentDate = startFrom
        ? new Date(startFrom)
        : task.due_date
          ? new Date(task.due_date)
          : new Date();
    let iterationCount = 0;
    const MAX_ITERATIONS = 100;

    while (occurrences.length < count && iterationCount < MAX_ITERATIONS) {
        if (
            task.recurrence_end_date &&
            currentDate > new Date(task.recurrence_end_date)
        ) {
            break;
        }

        occurrences.push({
            due_date: currentDate.toISOString().split('T')[0],
            is_virtual: true,
        });

        currentDate = calculateNextDueDate(task, currentDate);
        if (!currentDate) break;

        iterationCount++;
    }

    return occurrences;
};

module.exports = {
    calculateNextDueDate,
    calculateDailyRecurrence,
    calculateWeeklyRecurrence,
    calculateMonthlyRecurrence,
    calculateMonthlyWeekdayRecurrence,
    calculateMonthlyLastDayRecurrence,
    calculateVirtualOccurrences,
    shouldGenerateNextTask,
    getFirstWeekdayOfMonth,
    getLastWeekdayOfMonth,
    getNthWeekdayOfMonth,
    _getFirstWeekdayOfMonth: getFirstWeekdayOfMonth,
    _getLastWeekdayOfMonth: getLastWeekdayOfMonth,
    _getNthWeekdayOfMonth: getNthWeekdayOfMonth,
    _shouldGenerateNextTask: shouldGenerateNextTask,
};
