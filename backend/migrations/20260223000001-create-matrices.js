'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'matrices', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'projects',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            x_axis_label_left: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'Low Effort',
            },
            x_axis_label_right: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'High Effort',
            },
            y_axis_label_top: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'High Impact',
            },
            y_axis_label_bottom: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'Low Impact',
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

        await safeAddIndex(queryInterface, 'matrices', ['user_id'], {
            name: 'matrices_user_id_idx',
        });
        await safeAddIndex(queryInterface, 'matrices', ['project_id'], {
            name: 'matrices_project_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('matrices');
    },
};
