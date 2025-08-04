'use strict';

const { nanoid } = require('nanoid/non-secure');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add nanoid column to areas table
        await queryInterface.addColumn('areas', 'nanoid', {
            type: Sequelize.STRING(21),
            allowNull: true, // Initially allow null during migration
            unique: false, // Initially not unique during migration
        });

        // Create index on nanoid column for performance
        await queryInterface.addIndex('areas', ['nanoid'], {
            name: 'areas_nanoid_index',
        });

        // Get all existing areas and populate nanoid values
        const areas = await queryInterface.sequelize.query(
            'SELECT id FROM areas',
            { type: Sequelize.QueryTypes.SELECT }
        );

        // Update each area with a unique nanoid
        for (const area of areas) {
            const areaNanoid = nanoid();
            await queryInterface.sequelize.query(
                'UPDATE areas SET nanoid = ? WHERE id = ?',
                {
                    replacements: [areaNanoid, area.id],
                    type: Sequelize.QueryTypes.UPDATE,
                }
            );
        }

        // Add unique constraint after all nanoids are populated
        await queryInterface.addConstraint('areas', {
            fields: ['nanoid'],
            type: 'unique',
            name: 'areas_nanoid_unique',
        });

        // Change nanoid column to not allow null
        await queryInterface.changeColumn('areas', 'nanoid', {
            type: Sequelize.STRING(21),
            allowNull: false,
            unique: true,
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove unique constraint
        await queryInterface.removeConstraint('areas', 'areas_nanoid_unique');

        // Remove index
        await queryInterface.removeIndex('areas', 'areas_nanoid_index');

        // Remove nanoid column
        await queryInterface.removeColumn('areas', 'nanoid');
    },
};
