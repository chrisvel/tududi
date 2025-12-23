'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create join table for task subscribers
        await queryInterface.createTable('tasks_subscribers', {
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
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

        // Add composite unique index to prevent duplicate subscriptions
        await queryInterface.addIndex(
            'tasks_subscribers',
            ['task_id', 'user_id'],
            {
                unique: true,
                name: 'tasks_subscribers_unique_idx',
            }
        );

        // Add indexes for performance
        await queryInterface.addIndex('tasks_subscribers', ['task_id'], {
            name: 'tasks_subscribers_task_id_idx',
        });

        await queryInterface.addIndex('tasks_subscribers', ['user_id'], {
            name: 'tasks_subscribers_user_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('tasks_subscribers');
    },
};
