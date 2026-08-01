'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_project_areas', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'projects', key: 'id' },
                onDelete: 'CASCADE',
            },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'areas', key: 'id' },
                onDelete: 'SET NULL',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'user_project_areas', ['user_id']);
        await safeAddIndex(queryInterface, 'user_project_areas', [
            'project_id',
        ]);
        await safeAddIndex(
            queryInterface,
            'user_project_areas',
            ['user_id', 'project_id'],
            { unique: true, name: 'user_project_areas_user_project_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_project_areas');
    },
};
