'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable('tags');
        if (!tableDesc.pinned) {
            await queryInterface.addColumn('tags', 'pinned', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tags', 'pinned');
    },
};
