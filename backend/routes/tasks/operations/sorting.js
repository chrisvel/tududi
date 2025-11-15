const { compareTasksByField } = require('../core/comparators');

function createTaskComparator(orderColumn, orderDirection, safeTimezone) {
    return (a, b) => {
        const comparison = compareTasksByField(a, b, orderColumn, safeTimezone);
        return orderDirection === 'desc' ? -comparison : comparison;
    };
}

function sortTasksByOrder(tasks, orderBy, safeTimezone) {
    const [orderColumn, orderDirection = 'desc'] = orderBy.split(':');
    tasks.sort(createTaskComparator(orderColumn, orderDirection, safeTimezone));
}

module.exports = {
    createTaskComparator,
    sortTasksByOrder,
};
