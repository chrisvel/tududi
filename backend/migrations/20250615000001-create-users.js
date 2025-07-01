'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('users', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            telegram_bot_token: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            telegram_chat_id: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            task_summary_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            task_summary_frequency: {
                type: Sequelize.STRING,
                defaultValue: 'daily',
            },
            task_summary_last_run: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            task_summary_next_run: {
                type: Sequelize.DATE,
                allowNull: true,
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
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('users');
    },
};
