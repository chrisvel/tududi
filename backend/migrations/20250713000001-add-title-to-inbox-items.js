'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('inbox_items', 'title', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Title for the inbox item, especially for long content entries'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('inbox_items', 'title');
    }
};