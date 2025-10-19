'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('settings', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            value: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Add unique index on key column
        await queryInterface.addIndex('settings', ['key'], {
            name: 'settings_key_idx',
            unique: true,
        });

        // Seed initial registration_enabled setting with default value of false
        await queryInterface.bulkInsert('settings', [
            {
                key: 'registration_enabled',
                value: 'false',
                created_at: new Date(),
                updated_at: new Date(),
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('settings', 'settings_key_idx');
        await queryInterface.dropTable('settings');
    },
};
