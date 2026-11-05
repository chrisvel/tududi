'use strict';

const { safeCreateTable, safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableExists = await queryInterface
            .showAllTables()
            .then((tables) => tables.includes('projects_tags'));

        if (!tableExists) {
            await safeCreateTable(queryInterface, 'projects_tags', {
                project_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'projects',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                tag_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'tags',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            });

            await queryInterface.addConstraint('projects_tags', {
                fields: ['project_id', 'tag_id'],
                type: 'primary key',
                name: 'projects_tags_pkey',
            });
        } else {
            await safeAddColumns(queryInterface, 'projects_tags', [
                {
                    name: 'created_at',
                    definition: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
                {
                    name: 'updated_at',
                    definition: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
            ]);
        }
    },

    async down(queryInterface, Sequelize) {
        try {
            await queryInterface.removeColumn('projects_tags', 'created_at');
            await queryInterface.removeColumn('projects_tags', 'updated_at');
        } catch (error) {}
    },
};
