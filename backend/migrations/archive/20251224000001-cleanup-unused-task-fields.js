'use strict';

const { safeRemoveColumn } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');

        if (tableInfo.uuid) {
            try {
                await queryInterface.removeIndex('tasks', 'tasks_uuid_unique');
            } catch (e) {}
            await safeRemoveColumn(queryInterface, 'tasks', 'uuid');
        }

        if (tableInfo.description) {
            await safeRemoveColumn(queryInterface, 'tasks', 'description');
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
