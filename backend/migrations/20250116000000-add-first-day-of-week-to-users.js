'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'first_day_of_week',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 1, // Monday by default
                    validate: {
                        min: 0, // Sunday
                        max: 6, // Saturday
                    },
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'first_day_of_week');
    },
};
