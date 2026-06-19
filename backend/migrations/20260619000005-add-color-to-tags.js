'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable('tags');
        if (!tableDesc.color) {
            await queryInterface.addColumn('tags', 'color', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tags', 'color');
    },
};
