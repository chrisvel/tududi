'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create the projects_tags table if it doesn't exist
        const tableExists = await queryInterface
            .showAllTables()
            .then((tables) => tables.includes('projects_tags'));

        if (!tableExists) {
            await queryInterface.createTable('projects_tags', {
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

            // Add composite primary key
            await queryInterface.addConstraint('projects_tags', {
                fields: ['project_id', 'tag_id'],
                type: 'primary key',
                name: 'projects_tags_pkey',
            });
        } else {
            // Add timestamps if table exists but doesn't have them
            try {
                await queryInterface.addColumn('projects_tags', 'created_at', {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                });
            } catch (error) {
                // Column might already exist
            }

            try {
                await queryInterface.addColumn('projects_tags', 'updated_at', {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                });
            } catch (error) {
                // Column might already exist
            }
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove timestamps or drop table if needed
        try {
            await queryInterface.removeColumn('projects_tags', 'created_at');
            await queryInterface.removeColumn('projects_tags', 'updated_at');
        } catch (error) {
            // Columns might not exist
        }
    },
};
