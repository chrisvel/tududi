const { Task, Tag, Project, sequelize } = require('../../../models');
const { Op, QueryTypes } = require('sequelize');
const permissionsService = require('../../../services/permissionsService');
const {
    getSafeTimezone,
    getUpcomingRangeInUTC,
    getTodayBoundsInUTC,
} = require('../../../utils/timezone-utils');

async function filterTasksByParams(
    params,
    userId,
    userTimezone,
    permissionCache = null
) {
    const ownedOrShared = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId,
        permissionCache
    );
    if (params.type === 'upcoming') {
        params = { ...params };
        delete params.search;
    }
    let whereClause = {
        parent_task_id: null,
    };

    whereClause[Op.or] = [
        {
            [Op.and]: [
                {
                    [Op.or]: [
                        { recurrence_type: 'none' },
                        { recurrence_type: null },
                    ],
                },
                { recurring_parent_id: null },
            ],
        },
        {
            [Op.and]: [
                { recurrence_type: { [Op.ne]: 'none' } },
                { recurrence_type: { [Op.ne]: null } },
                { recurring_parent_id: null },
                {
                    [Op.or]: [
                        { due_date: null },
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        },
                    ],
                },
            ],
        },
        {
            [Op.and]: [
                { recurring_parent_id: { [Op.ne]: null } },
                {
                    [Op.or]: [
                        { due_date: null },
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        },
                    ],
                },
            ],
        },
    ];
    let includeClause = [
        {
            model: Tag,
            attributes: ['id', 'name', 'uid'],
            through: { attributes: [] },
        },
        {
            model: Project,
            attributes: ['id', 'name', 'state', 'uid'],
            required: false,
        },
        {
            model: Task,
            as: 'Subtasks',
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                    required: false,
                },
            ],
            required: false,
        },
    ];

    switch (params.type) {
        case 'today': {
            const safeTimezone = getSafeTimezone(userTimezone);
            const todayBounds = getTodayBoundsInUTC(safeTimezone);

            whereClause.status = {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            };
            whereClause[Op.or] = [
                {
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { recurrence_type: 'none' },
                                { recurrence_type: null },
                            ],
                        },
                        { recurring_parent_id: null },
                    ],
                },
                {
                    [Op.and]: [
                        { recurrence_type: { [Op.ne]: 'none' } },
                        { recurrence_type: { [Op.ne]: null } },
                        { recurring_parent_id: null },
                    ],
                },
                {
                    [Op.and]: [
                        { recurring_parent_id: { [Op.ne]: null } },
                        {
                            due_date: {
                                [Op.between]: [
                                    todayBounds.start,
                                    todayBounds.end,
                                ],
                            },
                        },
                    ],
                },
            ];
            break;
        }
        case 'upcoming': {
            const safeTimezone = getSafeTimezone(userTimezone);
            const upcomingRange = getUpcomingRangeInUTC(safeTimezone, 7);

            whereClause = {
                parent_task_id: null,
                due_date: {
                    [Op.between]: [upcomingRange.start, upcomingRange.end],
                },
                [Op.or]: [
                    {
                        [Op.and]: [
                            { recurring_parent_id: null },
                            {
                                [Op.or]: [
                                    { recurrence_type: 'none' },
                                    { recurrence_type: null },
                                ],
                            },
                        ],
                    },
                    {
                        [Op.and]: [
                            { recurring_parent_id: { [Op.ne]: null } },
                            { recurrence_type: 'none' },
                        ],
                    },
                ],
            };

            if (params.status === 'done' || params.status === 'completed') {
                whereClause.status = {
                    [Op.in]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (params.status === 'active') {
                whereClause.status = {
                    [Op.notIn]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            break;
        }
        case 'next':
            whereClause.due_date = null;
            whereClause.project_id = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'inbox':
            whereClause[Op.or] = [{ due_date: null }, { project_id: null }];
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'someday':
            whereClause.recurring_parent_id = null;
            whereClause.due_date = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'waiting':
            whereClause.status = Task.STATUS.WAITING;
            break;
        case 'all':
            if (params.status === 'done' || params.status === 'completed') {
                whereClause.status = {
                    [Op.in]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (params.status === 'active') {
                whereClause.status = {
                    [Op.notIn]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            break;
        default:
            if (!params.include_instances) {
                whereClause.recurring_parent_id = null;
            }
            if (params.status === 'done' || params.status === 'completed') {
                whereClause.status = {
                    [Op.in]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (params.status === 'active') {
                whereClause.status = {
                    [Op.notIn]: [
                        Task.STATUS.DONE,
                        Task.STATUS.ARCHIVED,
                        'done',
                        'archived',
                    ],
                };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
    }

    let tagFilteredTaskIds = null;

    if (params.priority) {
        whereClause.priority = Task.getPriorityValue(params.priority);
    }

    let orderClause = [['created_at', 'DESC']];

    if (params.type === 'inbox') {
        orderClause = [['created_at', 'DESC']];
    }

    if (params.order_by) {
        const [orderColumn, orderDirection = 'asc'] =
            params.order_by.split(':');
        const allowedColumns = [
            'created_at',
            'updated_at',
            'name',
            'priority',
            'status',
            'due_date',
        ];

        if (!allowedColumns.includes(orderColumn)) {
            throw new Error('Invalid order column specified.');
        }

        if (orderColumn === 'due_date') {
            orderClause = [
                [
                    sequelize.literal(
                        'CASE WHEN Task.due_date IS NULL THEN 1 ELSE 0 END'
                    ),
                    'ASC',
                ],
                ['due_date', orderDirection.toUpperCase()],
            ];
        } else {
            orderClause = [[orderColumn, orderDirection.toUpperCase()]];
        }
    }

    if (params.tag) {
        const taggedTaskIds = await sequelize.query(
            `SELECT DISTINCT tasks_tags.task_id
             FROM tasks_tags
             INNER JOIN tags ON tags.id = tasks_tags.tag_id
             WHERE tags.name = :tagName`,
            {
                replacements: { tagName: params.tag },
                type: QueryTypes.SELECT,
            }
        );

        tagFilteredTaskIds = taggedTaskIds.map((row) => row.task_id);

        // No tasks found with this tag - return early to avoid unnecessary query
        if (tagFilteredTaskIds.length === 0) {
            return [];
        }
    }

    if (tagFilteredTaskIds) {
        whereClause.id = {
            ...(whereClause.id || {}),
            [Op.in]: tagFilteredTaskIds,
        };
    }

    const finalWhereClause = {
        [Op.and]: [ownedOrShared, whereClause],
    };

    return await Task.findAll({
        where: finalWhereClause,
        include: includeClause,
        order: orderClause,
        distinct: true,
    });
}

function getTaskIncludeConfig() {
    return [
        {
            model: Tag,
            attributes: ['id', 'name', 'uid'],
            through: { attributes: [] },
            required: false,
        },
        {
            model: Project,
            attributes: ['id', 'name', 'state', 'uid'],
            required: false,
        },
        {
            model: Task,
            as: 'Subtasks',
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                    required: false,
                },
            ],
            required: false,
        },
    ];
}

module.exports = {
    filterTasksByParams,
    getTaskIncludeConfig,
};
