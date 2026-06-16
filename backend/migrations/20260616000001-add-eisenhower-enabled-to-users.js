'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('users');
        if (!tableDescription.eisenhower_enabled) {
            await queryInterface.addColumn('users', 'eisenhower_enabled', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'eisenhower_enabled');
    },
};
