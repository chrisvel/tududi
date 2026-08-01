'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'is_template',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
            {
                name: 'template_category',
                definition: {
                    type: Sequelize.STRING(100),
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'clone_count',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
            },
            {
                name: 'source_template_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    references: {
                        model: 'projects',
                        key: 'id',
                    },
                    onDelete: 'SET NULL',
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'projects', ['is_template'], {
            name: 'projects_is_template',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_is_template');
        await queryInterface.removeColumn('projects', 'source_template_id');
        await queryInterface.removeColumn('projects', 'clone_count');
        await queryInterface.removeColumn('projects', 'template_category');
        await queryInterface.removeColumn('projects', 'is_template');
    },
};
