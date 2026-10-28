'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'inbox_items', [
            {
                name: 'suggested_type',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'AI suggested item type: task, note, or null',
                },
            },
            {
                name: 'suggested_reason',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment:
                        'Reason for suggestion: verb_detected, bookmark_tag, etc.',
                },
            },
            {
                name: 'parsed_tags',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    comment: 'Array of parsed hashtags from content',
                },
            },
            {
                name: 'parsed_projects',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    comment: 'Array of parsed project references from content',
                },
            },
            {
                name: 'cleaned_content',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Content with tags and project references removed',
                },
            },
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('inbox_items', 'suggested_type');
        await queryInterface.removeColumn('inbox_items', 'suggested_reason');
        await queryInterface.removeColumn('inbox_items', 'parsed_tags');
        await queryInterface.removeColumn('inbox_items', 'parsed_projects');
        await queryInterface.removeColumn('inbox_items', 'cleaned_content');
    },
};
