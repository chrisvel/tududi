const { Tag, Project, Task } = require('../../../models');

const TASK_INCLUDES = [
    {
        model: Tag,
        attributes: ['id', 'name', 'uid'],
        through: { attributes: [] },
    },
    {
        model: Project,
        attributes: ['id', 'name', 'uid', 'image_url'],
        required: false,
    },
];

const TASK_INCLUDES_WITH_SUBTASKS = [
    ...TASK_INCLUDES,
    {
        model: Task,
        as: 'Subtasks',
        required: false,
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
            },
        ],
        separate: true, // Required for order to work with associations
        order: [
            ['order', 'ASC'],
            ['created_at', 'ASC'],
        ],
    },
];

module.exports = {
    TASK_INCLUDES,
    TASK_INCLUDES_WITH_SUBTASKS,
};
