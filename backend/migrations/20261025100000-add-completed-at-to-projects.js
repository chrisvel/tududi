'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

// When a project was marked done, for the completed projects history.
// Projects already done get their last update time as a best guess.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'completed_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);

        await queryInterface.sequelize.query(
            "UPDATE projects SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL"
        );

        const indexes = await queryInterface.showIndex('projects');
        if (!indexes.some((i) => i.name === 'projects_user_id_completed_at')) {
            await queryInterface.addIndex(
                'projects',
                ['user_id', 'completed_at'],
                { name: 'projects_user_id_completed_at' }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'projects',
            'projects_user_id_completed_at'
        );
        await queryInterface.removeColumn('projects', 'completed_at');
    },
};
