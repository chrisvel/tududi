'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'task_events', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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
            event_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            old_value: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            new_value: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            field_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            metadata: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'task_events', ['task_id']);
        await safeAddIndex(queryInterface, 'task_events', ['user_id']);
        await safeAddIndex(queryInterface, 'task_events', ['event_type']);
        await safeAddIndex(queryInterface, 'task_events', ['created_at']);
        await safeAddIndex(queryInterface, 'task_events', [
            'task_id',
            'event_type',
        ]);
        await safeAddIndex(queryInterface, 'task_events', [
            'task_id',
            'created_at',
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('task_events', [
            'task_id',
            'created_at',
        ]);
        await queryInterface.removeIndex('task_events', [
            'task_id',
            'event_type',
        ]);
        await queryInterface.removeIndex('task_events', ['created_at']);
        await queryInterface.removeIndex('task_events', ['event_type']);
        await queryInterface.removeIndex('task_events', ['user_id']);
        await queryInterface.removeIndex('task_events', ['task_id']);

        await queryInterface.dropTable('task_events');
    },
};
