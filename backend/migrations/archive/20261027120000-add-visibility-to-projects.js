'use strict';

const { safeAddColumns } = require('../utils/migration-utils');
const { uid } = require('../utils/uid');

// Shared areas now reach the tasks filed straight into them (no project). Those
// tasks were private to their owner until now, so before the rule applies they
// move into a private project per owner, named after the area, and the area
// owner is told. Nobody sees more after the upgrade than before it.
async function moveLooseTasksOutOfSharedAreas(queryInterface) {
    const { sequelize } = queryInterface;
    const select = (sql, replacements) =>
        sequelize.query(sql, {
            replacements,
            type: sequelize.QueryTypes.SELECT,
        });

    const sharedAreas = await select(
        `SELECT id, uid, name, user_id FROM areas
         WHERE uid IN (SELECT resource_uid FROM permissions WHERE resource_type = 'area')
            OR uid IN (SELECT resource_uid FROM group_permissions WHERE resource_type = 'area')`
    );

    const now = new Date();
    for (const area of sharedAreas) {
        const owners = await select(
            `SELECT user_id, COUNT(*) AS count FROM tasks
             WHERE area_id = :areaId AND project_id IS NULL
             GROUP BY user_id`,
            { areaId: area.id }
        );
        if (owners.length === 0) continue;

        let moved = 0;
        for (const owner of owners) {
            const projectUid = uid();
            await queryInterface.bulkInsert('projects', [
                {
                    uid: projectUid,
                    name: `Moved from ${area.name}`,
                    user_id: owner.user_id,
                    status: 'not_started',
                    visibility: 'area',
                    created_at: now,
                    updated_at: now,
                },
            ]);
            const [project] = await select(
                'SELECT id FROM projects WHERE uid = :uid',
                { uid: projectUid }
            );
            await sequelize.query(
                `UPDATE tasks SET project_id = :projectId, area_id = NULL
                 WHERE area_id = :areaId AND project_id IS NULL AND user_id = :userId`,
                {
                    replacements: {
                        projectId: project.id,
                        areaId: area.id,
                        userId: owner.user_id,
                    },
                }
            );
            moved += Number(owner.count);
        }

        await queryInterface.bulkInsert('notifications', [
            {
                uid: uid(),
                user_id: area.user_id,
                type: 'system',
                level: 'info',
                title: `Tasks moved out of ${area.name}`,
                message: `${moved} task${moved === 1 ? ' was' : 's were'} filed straight into ${area.name} without a project. Shared areas now show those tasks to everyone in the area, so they were kept private in projects named "Moved from ${area.name}". Move them back when they should be shared.`,
                data: JSON.stringify({ area_uid: area.uid, moved }),
                sources: JSON.stringify([]),
                sent_at: now,
                created_at: now,
                updated_at: now,
            },
        ]);
    }
}

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'visibility',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'area',
                },
            },
        ]);

        await moveLooseTasksOutOfSharedAreas(queryInterface);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('projects', 'visibility');
    },
};
