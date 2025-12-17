const moment = require('moment-timezone');

function compareTasksByField(a, b, field, safeTimezone, userId = null) {
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

        case 'assigned': {
            // "Assigned to me" always comes first, regardless of sort direction
            const aIsAssignedToMe = a.assigned_to_user_id === userId;
            const bIsAssignedToMe = b.assigned_to_user_id === userId;

            if (aIsAssignedToMe && !bIsAssignedToMe) {
                return -1;
            }
            if (!aIsAssignedToMe && bIsAssignedToMe) {
                return 1;
            }

            // If both or neither are assigned to me, sort by assignee name
            const aName = a.AssignedTo
                ? `${a.AssignedTo.name || ''} ${a.AssignedTo.surname || ''}`.trim()
                : '';
            const bName = b.AssignedTo
                ? `${b.AssignedTo.name || ''} ${b.AssignedTo.surname || ''}`.trim()
                : '';

            // Tasks with no assignee go to the end
            if (!aName && bName) return 1;
            if (aName && !bName) return -1;
            if (!aName && !bName) return 0;

            return aName.localeCompare(bName);
        }

        case 'created_at':
        default:
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    }
}

module.exports = {
    compareTasksByField,
};
