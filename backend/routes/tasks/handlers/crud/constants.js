const { Tag, Project, Task } = require('../../../../models');

const TASK_INCLUDES = [
    {
        model: Tag,
        attributes: ['id', 'name', 'uid'],
        through: { attributes: [] },
    },
    {
        model: Project,
        attributes: ['id', 'name', 'uid'],
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
    },
];

module.exports = {
    TASK_INCLUDES,
    TASK_INCLUDES_WITH_SUBTASKS,
};
