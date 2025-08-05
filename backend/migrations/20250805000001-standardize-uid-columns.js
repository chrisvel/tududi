'use strict';

const { uid } = require('../utils/uid');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints for SQLite
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Add uid columns to all tables
            const tables = [
                { name: 'areas', hasUid: false },
                { name: 'projects', hasUid: false },
                { name: 'notes', hasUid: false },
                { name: 'tags', hasUid: false },
                { name: 'tasks', hasUid: false }, // Keep existing uuid column, add new uid column
            ];

            // 1. Add uid columns to all tables
            for (const table of tables) {
                await safeAddColumns(queryInterface, table.name, [
                    {
                        name: 'uid',
                        definition: {
                            type: Sequelize.STRING,
                            allowNull: true, // Initially allow null during population
                        },
                    },
                ]);
            }

            // 2. Populate uid values for all tables
            for (const table of tables) {
                // Get records without uid values
                const records = await queryInterface.sequelize.query(
                    `SELECT id FROM ${table.name} WHERE uid IS NULL`,
                    { type: Sequelize.QueryTypes.SELECT }
                );

                // Generate uid for each record
                for (const record of records) {
                    const uniqueId = uid();
                    await queryInterface.sequelize.query(
                        `UPDATE ${table.name} SET uid = ? WHERE id = ?`,
                        {
                            replacements: [uniqueId, record.id],
                            type: Sequelize.QueryTypes.UPDATE,
                        }
                    );
                }

                // Make uid column not null and unique
                await queryInterface.changeColumn(table.name, 'uid', {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true,
                });

                // Add unique index for performance
                await safeAddIndex(queryInterface, table.name, ['uid'], {
                    unique: true,
                    name: `${table.name}_uid_unique_index`,
                });
            }
        } finally {
            // Re-enable foreign key constraints
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove unique indexes and uid columns
        const tables = ['areas', 'projects', 'notes', 'tags', 'tasks'];

        for (const tableName of tables) {
            try {
                await queryInterface.removeIndex(
                    tableName,
                    `${tableName}_uid_unique_index`
                );
            } catch (error) {
                // Index might not exist
                console.log(
                    `${tableName}_uid_unique_index not found, skipping removal`
                );
            }

            try {
                await queryInterface.removeColumn(tableName, 'uid');
            } catch (error) {
                console.log(
                    `Error removing uid column from ${tableName}:`,
                    error.message
                );
            }
        }
    },
};
