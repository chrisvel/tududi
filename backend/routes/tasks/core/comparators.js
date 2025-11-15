const moment = require('moment-timezone');

function compareTasksByField(a, b, field, safeTimezone) {
    switch (field) {
        case 'priority':
            return (a.priority || 0) - (b.priority || 0);

        case 'name':
            return (a.name || '').localeCompare(b.name || '');

        case 'due_date':
            if (a.due_date && b.due_date) {
                const timeA = moment.tz(a.due_date, safeTimezone);
                const timeB = moment.tz(b.due_date, safeTimezone);
                return (
                    timeA.hour() * 60 +
                    timeA.minute() -
                    (timeB.hour() * 60 + timeB.minute())
                );
            } else if (a.due_date && !b.due_date) {
                return -1;
            } else if (!a.due_date && b.due_date) {
                return 1;
            }
            return 0;

        case 'created_at':
        default:
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    }
}

module.exports = {
    compareTasksByField,
};
