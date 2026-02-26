'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'task_matrices', {
            task_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            matrix_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: 'matrices',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            quadrant_index: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            position: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'task_matrices', ['matrix_id'], {
            name: 'task_matrices_matrix_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('task_matrices');
    },
};
