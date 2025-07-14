'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('inbox_items', 'title', {
            type: Sequelize.STRING,
            allowNull: true,
            comment:
                'Optional title field for inbox items, auto-generated for long content',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('inbox_items', 'title');
    },
};
