'use strict';

const { uid } = require('../utils/nanoid');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = [
            'users',
            'areas',
            'projects',
            'tasks',
            'notes',
            'tags',
            'inbox_items',
            'task_events',
            'calendar_tokens',
        ];

        // Add uid column to all tables
        for (const tableName of tables) {
            await safeAddColumns(queryInterface, tableName, [
                {
                    name: 'uid',
                    definition: {
                        type: Sequelize.STRING,
                        allowNull: true, // Start as nullable to populate existing records
                    },
                },
            ]);
        }

        // Populate uid for existing records in each table
        for (const tableName of tables) {
            const records = await queryInterface.sequelize.query(
                `SELECT id FROM ${tableName} WHERE uid IS NULL`,
                { type: Sequelize.QueryTypes.SELECT }
            );

            for (const record of records) {
                const generatedUid = uid();
                await queryInterface.sequelize.query(
                    `UPDATE ${tableName} SET uid = ? WHERE id = ?`,
                    { replacements: [generatedUid, record.id] }
                );
            }
        }

        // Make uid NOT NULL and add unique indexes
        for (const tableName of tables) {
            await queryInterface.changeColumn(tableName, 'uid', {
                type: Sequelize.STRING,
                allowNull: false,
            });

            await safeAddIndex(queryInterface, tableName, ['uid'], {
                unique: true,
                name: `${tableName}_uid_unique`,
            });
        }
    },

    async down(queryInterface, Sequelize) {
        const tables = [
            'users',
            'areas',
            'projects',
            'tasks',
            'notes',
            'tags',
            'inbox_items',
            'task_events',
            'calendar_tokens',
        ];

        // Remove indexes and columns
        for (const tableName of tables) {
            await queryInterface.removeIndex(
                tableName,
                `${tableName}_uid_unique`
            );
            await queryInterface.removeColumn(tableName, 'uid');
        }
    },
};
