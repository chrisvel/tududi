'use strict';

// Migrations run on SQLite and PostgreSQL. Keep them dialect-safe:
//   - prefer the safe* helpers in ../utils/migration-utils.js
//   - no PRAGMA, sqlite_master, AUTOINCREMENT or backtick identifiers
//   - compare booleans with true/false, never 0/1
//   - branch on queryInterface.sequelize.getDialect() only when unavoidable
// See docs/database.md, "Writing dialect-safe migrations".

// Accounts created before the User model started lowercasing emails on write
// (February 2026) still store the address as typed. Login, registration and
// OIDC provisioning now look users up by the lowercased email, so those
// accounts became unreachable and TUDUDI_USER_EMAIL created a second, empty
// admin on start. Normalise the stored value; rows that would collide with
// another account after lowercasing are left untouched and reported so an
// administrator can merge them by hand.

module.exports = {
    async up(queryInterface, Sequelize) {
        const { sequelize } = queryInterface;
        const { QueryTypes } = Sequelize;

        const peopleColumns = await queryInterface
            .describeTable('people')
            .catch(() => ({}));
        const syncSelfPerson = Boolean(
            peopleColumns.linked_user_id && peopleColumns.email
        );

        const transaction = await sequelize.transaction();
        try {
            const mixedCase = await sequelize.query(
                'SELECT id, email FROM users WHERE email IS NOT NULL AND email <> LOWER(email)',
                { type: QueryTypes.SELECT, transaction }
            );

            let updated = 0;
            const skipped = [];
            for (const user of mixedCase) {
                const lower = user.email.trim().toLowerCase();
                const collisions = await sequelize.query(
                    'SELECT id FROM users WHERE LOWER(email) = :lower AND id <> :id',
                    {
                        replacements: { lower, id: user.id },
                        type: QueryTypes.SELECT,
                        transaction,
                    }
                );
                if (collisions.length > 0) {
                    skipped.push({
                        id: user.id,
                        email: user.email,
                        collidesWith: collisions.map((row) => row.id),
                    });
                    continue;
                }

                await sequelize.query(
                    'UPDATE users SET email = :lower WHERE id = :id',
                    { replacements: { lower, id: user.id }, transaction }
                );
                if (syncSelfPerson) {
                    await sequelize.query(
                        'UPDATE people SET email = :lower WHERE user_id = :id AND linked_user_id = :id AND email IS NOT NULL',
                        { replacements: { lower, id: user.id }, transaction }
                    );
                }
                updated++;
            }

            await transaction.commit();

            if (updated > 0) {
                console.log(`Lowercased ${updated} user email(s)`);
            }
            for (const entry of skipped) {
                console.warn(
                    `⚠️  users.id=${entry.id} keeps email "${entry.email}": lowercasing it would collide with users.id=${entry.collidesWith.join(', ')}. Merge or rename one of the accounts by hand.`
                );
            }
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down() {
        // The original casing is not recorded; lowercased emails stay valid.
    },
};
