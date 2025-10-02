'use strict';

const { uid } = require('../utils/uid');
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            await safeAddColumns(queryInterface, 'users', [
                {
                    name: 'uid',
                    definition: {
                        type: Sequelize.STRING,
                        allowNull: true,
                    },
                },
            ]);

            const users = await queryInterface.sequelize.query(
                'SELECT id FROM users WHERE uid IS NULL',
                { type: Sequelize.QueryTypes.SELECT }
            );

            for (const user of users) {
                const uniqueId = uid();
                await queryInterface.sequelize.query(
                    'UPDATE users SET uid = ? WHERE id = ?',
                    {
                        replacements: [uniqueId, user.id],
                        type: Sequelize.QueryTypes.UPDATE,
                    }
                );
            }

            await queryInterface.changeColumn('users', 'uid', {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            });

            await safeAddIndex(queryInterface, 'users', ['uid'], {
                unique: true,
                name: 'users_uid_unique_index',
            });
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
        }
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeIndex('users', 'users_uid_unique_index');
        } catch (error) {
            console.log('users_uid_unique_index not found, skipping removal');
        }

        try {
            await queryInterface.removeColumn('users', 'uid');
        } catch (error) {
            console.log('Error removing uid column from users:', error.message);
        }
    },
};
