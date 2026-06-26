'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('users');
        if (!tableInfo.ai_daily_brief) {
            await queryInterface.addColumn('users', 'ai_daily_brief', {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: null,
            });
        }
        if (!tableInfo.ai_daily_brief_date) {
            await queryInterface.addColumn('users', 'ai_daily_brief_date', {
                type: Sequelize.DATEONLY,
                allowNull: true,
                defaultValue: null,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'ai_daily_brief');
        await queryInterface.removeColumn('users', 'ai_daily_brief_date');
    },
};
