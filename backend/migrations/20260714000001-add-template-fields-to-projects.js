'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('projects');

        if (!tableInfo.is_template) {
            await queryInterface.addColumn('projects', 'is_template', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }

        if (!tableInfo.template_category) {
            await queryInterface.addColumn('projects', 'template_category', {
                type: Sequelize.STRING(100),
                allowNull: true,
                defaultValue: null,
            });
        }

        if (!tableInfo.clone_count) {
            await queryInterface.addColumn('projects', 'clone_count', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }

        if (!tableInfo.source_template_id) {
            await queryInterface.addColumn('projects', 'source_template_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'projects',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            });
        }

        await queryInterface.addIndex('projects', ['is_template'], {
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
