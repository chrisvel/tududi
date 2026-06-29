'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('projects');
        if (!tableInfo.ai_insights) {
            await queryInterface.addColumn('projects', 'ai_insights', {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: null,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('projects', 'ai_insights');
    },
};
