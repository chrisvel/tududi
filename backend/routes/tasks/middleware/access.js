const { hasAccess } = require('../../../middleware/authorize');

const requireTaskReadAccess = hasAccess(
    'ro',
    'task',
    async (req) => {
        return req.params.uid;
    },
    { notFoundMessage: 'Task not found.' }
);

const requireTaskWriteAccess = hasAccess(
    'rw',
    'task',
    async (req) => {
        return req.params.uid;
    },
    { notFoundMessage: 'Task not found.' }
);

module.exports = {
    requireTaskReadAccess,
    requireTaskWriteAccess,
};
