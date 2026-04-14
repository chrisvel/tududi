const ICAL = require('ical.js');
const { WEEKDAY_MAP } = require('./field-mappings');

function generateRRULE(task) {
    if (!task.recurrence_type || task.recurrence_type === 'none') {
        return null;
    }

    const parts = [];

    switch (task.recurrence_type) {
        case 'daily':
            parts.push('FREQ=DAILY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            break;

        case 'weekly':
            parts.push('FREQ=WEEKLY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            if (task.recurrence_weekdays && task.recurrence_weekdays.length > 0) {
                const weekdaysArray =
                    typeof task.recurrence_weekdays === 'string'
                        ? JSON.parse(task.recurrence_weekdays)
                        : task.recurrence_weekdays;

                const days = weekdaysArray
                    .map((d) => WEEKDAY_MAP[d])
                    .filter(Boolean)
                    .join(',');
                if (days) {
                    parts.push(`BYDAY=${days}`);
                }
            }
            break;

        case 'monthly':
            parts.push('FREQ=MONTHLY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            if (task.recurrence_month_day) {
                parts.push(`BYMONTHDAY=${task.recurrence_month_day}`);
            }
            break;

        case 'monthly_weekday':
            parts.push('FREQ=MONTHLY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            if (
                task.recurrence_week_of_month &&
                task.recurrence_weekday !== null
            ) {
                const day = WEEKDAY_MAP[task.recurrence_weekday];
                if (day) {
                    parts.push(`BYDAY=${task.recurrence_week_of_month}${day}`);
                }
            }
            break;

        case 'monthly_last_day':
            parts.push('FREQ=MONTHLY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            parts.push('BYMONTHDAY=-1');
            break;

        case 'yearly':
            parts.push('FREQ=YEARLY');
            if (task.recurrence_interval && task.recurrence_interval > 1) {
                parts.push(`INTERVAL=${task.recurrence_interval}`);
            }
            break;

        default:
            return null;
    }

    if (task.recurrence_end_date) {
        try {
            const endDate = new Date(task.recurrence_end_date);
            const until = ICAL.Time.fromJSDate(endDate, true);
            parts.push(`UNTIL=${until.toICALString()}`);
        } catch (error) {
            console.error('Error formatting UNTIL date:', error);
        }
    }

    return parts.length > 0 ? parts.join(';') : null;
}

module.exports = {
    generateRRULE,
};
