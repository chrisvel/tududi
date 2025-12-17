const { compareTasksByField } = require('../core/comparators');

function createTaskComparator(
    orderColumn,
    orderDirection,
    safeTimezone,
    userId = null
) {
    return (a, b) => {
        const comparison = compareTasksByField(
            a,
            b,
            orderColumn,
            safeTimezone,
            userId
        );
        // For 'assigned' field, ignore the orderDirection for "assigned to me" priority
        // The comparator already handles "assigned to me" always being first
        if (orderColumn === 'assigned') {
            return comparison;
        }
        return orderDirection === 'desc' ? -comparison : comparison;
    };
}

function sortTasksByOrder(tasks, orderBy, safeTimezone, userId = null) {
    const [orderColumn, orderDirection = 'desc'] = orderBy.split(':');
    tasks.sort(
        createTaskComparator(orderColumn, orderDirection, safeTimezone, userId)
    );
}

module.exports = {
    createTaskComparator,
    sortTasksByOrder,
};
