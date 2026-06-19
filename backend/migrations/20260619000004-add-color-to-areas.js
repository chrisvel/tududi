'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable('areas');
        if (!tableDesc.color) {
            await queryInterface.addColumn('areas', 'color', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('areas', 'color');
    },
};
