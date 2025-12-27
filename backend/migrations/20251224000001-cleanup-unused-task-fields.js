'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');

        // Remove uuid field (redundant with uid)
        if (tableInfo.uuid) {
            await queryInterface.removeColumn('tasks', 'uuid');
        }

        // Remove description field (tasks use note instead)
        if (tableInfo.description) {
            await queryInterface.removeColumn('tasks', 'description');
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');

        if (!tableInfo.uuid) {
            await queryInterface.addColumn('tasks', 'uuid', {
                type: Sequelize.UUID,
                allowNull: true,
                unique: true,
            });
        }

        if (!tableInfo.description) {
            await queryInterface.addColumn('tasks', 'description', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }
    },
};
