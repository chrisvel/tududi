'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create user_project_areas junction table
        await safeCreateTable(queryInterface, 'user_project_areas', {
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'projects',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Add composite primary key (user_id, project_id)
        await safeAddIndex('user_project_areas', ['user_id', 'project_id'], {
            unique: true,
            name: 'user_project_areas_pkey',
        });

        // Add index on project_id for reverse lookups
        await safeAddIndex('user_project_areas', ['project_id'], {
            name: 'user_project_areas_project_id_idx',
        });

        // Add index on area_id for CASCADE delete performance
        await safeAddIndex('user_project_areas', ['area_id'], {
            name: 'user_project_areas_area_id_idx',
        });

        // Add composite index on (user_id, area_id) for area-based filtering
        await safeAddIndex('user_project_areas', ['user_id', 'area_id'], {
            name: 'user_project_areas_user_area_idx',
        });

        // Migrate existing data: For each project with area_id, create entry for project owner
        await queryInterface.sequelize.query(`
            INSERT INTO user_project_areas (user_id, project_id, area_id, created_at, updated_at)
            SELECT p.user_id, p.id, p.area_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM projects p
            WHERE p.area_id IS NOT NULL
        `);

        console.log('Successfully migrated existing project-area assignments to user_project_areas');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('user_project_areas');
    },
};
