'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

// Files on projects and notes, shaped like task_attachments.
const TABLES = [
    {
        table: 'project_attachments',
        owner: 'project_id',
        ownerTable: 'projects',
    },
    { table: 'note_attachments', owner: 'note_id', ownerTable: 'notes' },
];

module.exports = {
    async up(queryInterface, Sequelize) {
        for (const { table, owner, ownerTable } of TABLES) {
            await safeCreateTable(queryInterface, table, {
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
                [owner]: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: ownerTable, key: 'id' },
                    onDelete: 'CASCADE',
                },
                user_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                },
                original_filename: {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                stored_filename: {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                file_size: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                },
                mime_type: {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                file_path: {
                    type: Sequelize.STRING,
                    allowNull: false,
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

            await safeAddIndex(queryInterface, table, [owner], {
                name: `${table}_${owner}`,
            });
            await safeAddIndex(queryInterface, table, ['user_id'], {
                name: `${table}_user_id`,
            });
            await safeAddIndex(queryInterface, table, ['uid'], {
                name: `${table}_uid`,
                unique: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('note_attachments');
        await queryInterface.dropTable('project_attachments');
    },
};
