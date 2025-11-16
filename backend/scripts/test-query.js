const { Task, sequelize } = require('../models');
const { Op } = require('sequelize');

async function testQuery() {
    const whereClause = {
        parent_task_id: null,
        status: {
            [Op.notIn]: [
                Task.STATUS.DONE,
                Task.STATUS.ARCHIVED,
                'done',
                'archived',
            ],
        },
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
            [Op.and]: [{ recurring_parent_id: { [Op.ne]: null } }],
        },
    ];

    // Log the SQL that will be generated
    const query = Task.findAll({
        where: whereClause,
        attributes: ['id', 'name', 'recurrence_type', 'recurring_parent_id'],
        logging: console.log,
    });

    console.log('\nThis query should:');
    console.log(
        '✓ Include: Regular tasks (recurrence_type = null/none, recurring_parent_id = null)'
    );
    console.log('✓ Include: Recurring instances (recurring_parent_id != null)');
    console.log(
        '✗ Exclude: Recurring parent templates (recurrence_type = daily/weekly/etc, recurring_parent_id = null)'
    );

    await sequelize.close();
}

testQuery().catch((err) => {
    console.error(err);
    process.exit(1);
});
