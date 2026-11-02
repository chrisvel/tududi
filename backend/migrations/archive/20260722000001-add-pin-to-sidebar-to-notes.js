'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('notes');
        if ('pin_to_sidebar' in tableInfo) return;

        await queryInterface.addColumn('notes', 'pin_to_sidebar', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('notes', 'pin_to_sidebar');
    },
};
