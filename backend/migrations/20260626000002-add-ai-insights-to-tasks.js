'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');
        if (!tableInfo.ai_insights) {
            await queryInterface.addColumn('tasks', 'ai_insights', {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: null,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tasks', 'ai_insights');
    },
};
