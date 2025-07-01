'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create task_events table
        await queryInterface.createTable('task_events', {
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
                // Common event types: 'created', 'status_changed', 'priority_changed',
                // 'due_date_changed', 'project_changed', 'name_changed', 'description_changed',
                // 'completed', 'archived', 'deleted', 'restored'
            },
            old_value: {
                type: Sequelize.TEXT,
                allowNull: true,
                // JSON string of the old value(s) - for tracking what changed from
            },
            new_value: {
                type: Sequelize.TEXT,
                allowNull: true,
                // JSON string of the new value(s) - for tracking what changed to
            },
            field_name: {
                type: Sequelize.STRING,
                allowNull: true,
                // The name of the field that was changed (status, priority, due_date, etc.)
            },
            metadata: {
                type: Sequelize.TEXT,
                allowNull: true,
                // Additional context as JSON string (e.g., source of change: 'web', 'api', 'telegram')
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Add indexes for better query performance
        await queryInterface.addIndex('task_events', ['task_id']);
        await queryInterface.addIndex('task_events', ['user_id']);
        await queryInterface.addIndex('task_events', ['event_type']);
        await queryInterface.addIndex('task_events', ['created_at']);
        await queryInterface.addIndex('task_events', ['task_id', 'event_type']);
        await queryInterface.addIndex('task_events', ['task_id', 'created_at']);
    },

    async down(queryInterface, Sequelize) {
        // Remove indexes first
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

        // Drop the table
        await queryInterface.dropTable('task_events');
    },
};
