'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Change task name from VARCHAR(255) to TEXT to prevent truncation
        await queryInterface.changeColumn('tasks', 'name', {
            type: Sequelize.TEXT,
            allowNull: false,
        });

        // Change inbox_items cleaned_content from VARCHAR(255) to TEXT
        await queryInterface.changeColumn('inbox_items', 'cleaned_content', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Content with tags and project references removed',
        });

        // Change inbox_items title from VARCHAR(255) to TEXT
        await queryInterface.changeColumn('inbox_items', 'title', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment:
                'Optional title field for inbox items, auto-generated for long content',
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert back to VARCHAR(255)
        await queryInterface.changeColumn('tasks', 'name', {
            type: Sequelize.STRING,
            allowNull: false,
        });

        await queryInterface.changeColumn('inbox_items', 'cleaned_content', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Content with tags and project references removed',
        });

        await queryInterface.changeColumn('inbox_items', 'title', {
            type: Sequelize.STRING,
            allowNull: true,
            comment:
                'Optional title field for inbox items, auto-generated for long content',
        });
    },
};
