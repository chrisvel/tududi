'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('tasks');
        if (!tableDescription.reminder_at) {
            await queryInterface.addColumn('tasks', 'reminder_at', {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tasks', 'reminder_at');
    },
};
