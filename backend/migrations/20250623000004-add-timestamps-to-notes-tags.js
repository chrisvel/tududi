'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add created_at and updated_at columns to notes_tags table
        try {
            await queryInterface.addColumn('notes_tags', 'created_at', {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            });

            await queryInterface.addColumn('notes_tags', 'updated_at', {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            });

            console.log('Successfully added timestamps to notes_tags table');
        } catch (error) {
            console.error('Error adding timestamps to notes_tags:', error);
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('notes_tags', 'created_at');
        await queryInterface.removeColumn('notes_tags', 'updated_at');
    },
};
