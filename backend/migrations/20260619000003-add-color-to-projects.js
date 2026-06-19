'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable('projects');
        if (!tableDesc.color) {
            await queryInterface.addColumn('projects', 'color', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('projects', 'color');
    },
};
