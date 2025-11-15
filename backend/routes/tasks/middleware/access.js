const { hasAccess } = require('../../../middleware/authorize');
const taskRepository = require('../../../repositories/TaskRepository');

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
        const t = await taskRepository.findById(req.params.id, {
            attributes: ['uid'],
        });
        return t?.uid;
    },
    { notFoundMessage: 'Task not found.' }
);

module.exports = {
    requireTaskReadAccess,
    requireTaskWriteAccess,
};
