'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

const INDEX_NAME = 'users_created_by_user_id';

// safeAddIndex skips an index when any of its columns is already indexed, so
// the index is added directly and guarded by name.
async function addIndexOnce(queryInterface) {
    const indexes = await queryInterface.showIndex('users');
    if (indexes.some((index) => index.name === INDEX_NAME)) return;
    await queryInterface.addIndex('users', ['created_by_user_id'], {
        name: INDEX_NAME,
    });
}

module.exports = {
    // Who created an account. It is a plain number, not a foreign key, so an
    // existing users table is only added to and never rebuilt. Accounts that
    // already exist have no creator.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'created_by_user_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
        await addIndexOnce(queryInterface);
    },

    async down(queryInterface) {
        const indexes = await queryInterface.showIndex('users');
        if (indexes.some((index) => index.name === INDEX_NAME)) {
            await queryInterface.removeIndex('users', INDEX_NAME);
        }
        const info = await queryInterface.describeTable('users');
        if ('created_by_user_id' in info) {
            // removeColumn would rebuild the users table on SQLite. A native
            // DROP COLUMN leaves the table, its indexes and the tables that
            // point at it alone.
            await queryInterface.sequelize.query(
                'ALTER TABLE "users" DROP COLUMN "created_by_user_id"'
            );
        }
    },
};
