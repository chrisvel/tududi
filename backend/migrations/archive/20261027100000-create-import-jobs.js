'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

// One spreadsheet import: the parsed file while the user maps and reviews it,
// then what the import created and changed, so it can be undone. Purely
// additive.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'import_jobs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            file_name: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING(16),
                allowNull: false,
                defaultValue: 'parsed',
            },
            sheets: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            options: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            result: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            committed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            undone_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        const indexes = await queryInterface.showIndex('import_jobs');
        if (!indexes.some((i) => i.name === 'import_jobs_user_created')) {
            await queryInterface.addIndex(
                'import_jobs',
                ['user_id', 'created_at'],
                { name: 'import_jobs_user_created' }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('import_jobs');
    },
};
