'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('inbox_items', 'suggested_type', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'AI suggested item type: task, note, or null'
        });

        await queryInterface.addColumn('inbox_items', 'suggested_reason', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Reason for suggestion: verb_detected, bookmark_tag, etc.'
        });

        await queryInterface.addColumn('inbox_items', 'parsed_tags', {
            type: Sequelize.JSON,
            allowNull: true,
            comment: 'Array of parsed hashtags from content'
        });

        await queryInterface.addColumn('inbox_items', 'parsed_projects', {
            type: Sequelize.JSON,
            allowNull: true,
            comment: 'Array of parsed project references from content'
        });

        await queryInterface.addColumn('inbox_items', 'cleaned_content', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Content with tags and project references removed'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('inbox_items', 'suggested_type');
        await queryInterface.removeColumn('inbox_items', 'suggested_reason');
        await queryInterface.removeColumn('inbox_items', 'parsed_tags');
        await queryInterface.removeColumn('inbox_items', 'parsed_projects');
        await queryInterface.removeColumn('inbox_items', 'cleaned_content');
    }
};