'use strict';

const { uid } = require('../utils/uid');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable foreign key constraints for SQLite
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // 1. Add uid column to inbox_items table
            await safeAddColumns(queryInterface, 'inbox_items', [
                {
                    name: 'uid',
                    definition: {
                        type: Sequelize.STRING,
                        allowNull: true, // Initially allow null during population
                    },
                },
            ]);

            // 2. Populate uid values for existing inbox items
            const records = await queryInterface.sequelize.query(
                'SELECT id FROM inbox_items WHERE uid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Generate uid for each record
            for (const record of records) {
                const uniqueId = uid();
                await queryInterface.sequelize.query(
                    'UPDATE inbox_items SET uid = ? WHERE id = ?',
                    {
                        replacements: [uniqueId, record.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            // 3. Make uid column not null and unique
            await queryInterface.changeColumn('inbox_items', 'uid', {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            });

            // 4. Add unique index for performance
            await safeAddIndex(queryInterface, 'inbox_items', ['uid'], {
                unique: true,
                name: 'inbox_items_uid_unique_index',
            });
        } finally {
            // Re-enable foreign key constraints
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
        }
    },

    async down(queryInterface, Sequelize) {
        try {
            // Remove unique index
            await queryInterface.removeIndex(
                'inbox_items',
                'inbox_items_uid_unique_index'
            );
        } catch (error) {
            console.log(
                'inbox_items_uid_unique_index not found, skipping removal'
            );
        }

        try {
            // Remove uid column
            await queryInterface.removeColumn('inbox_items', 'uid');
        } catch (error) {
            console.log(
                'Error removing uid column from inbox_items:',
                error.message
            );
        }
    },
};
