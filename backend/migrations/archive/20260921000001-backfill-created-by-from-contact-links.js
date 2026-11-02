'use strict';

// Migrations run on SQLite and PostgreSQL. Keep them dialect-safe:
//   - prefer the safe* helpers in ../utils/migration-utils.js
//   - no PRAGMA, sqlite_master, AUTOINCREMENT or backtick identifiers
//   - compare booleans with true/false, never 0/1
//   - branch on queryInterface.sequelize.getDialect() only when unavoidable
// See docs/database.md, "Writing dialect-safe migrations".

// Before users.created_by_user_id existed, an admin who gave a contact an
// account left the contact card owned by the admin and linked to the new
// account. Nothing else recorded who created it, so those accounts still have
// no creator and show as plain contacts instead of members.
//
// The creator is taken from that link, for accounts without one only. Creating
// accounts was admin only then, so the card's owner has to be an admin now:
// a link made by an ordinary user never counts, and an admin who has since
// been demoted is skipped rather than guessed. When several admins have a card
// linked to the same account, the oldest card wins.

const CREATOR_OF_USER = `
    SELECT p.user_id
    FROM people p
    INNER JOIN roles r ON r.user_id = p.user_id
    WHERE r.is_admin = :admin
      AND p.linked_user_id = users.id
      AND p.user_id <> users.id`;

module.exports = {
    async up(queryInterface) {
        const { sequelize } = queryInterface;

        const users = await queryInterface.describeTable('users');
        const people = await queryInterface
            .describeTable('people')
            .catch(() => null);
        const roles = await queryInterface
            .describeTable('roles')
            .catch(() => null);
        if (
            !users.created_by_user_id ||
            !people?.linked_user_id ||
            !roles?.is_admin
        ) {
            return;
        }

        await sequelize.query(
            `UPDATE users
             SET created_by_user_id = (${CREATOR_OF_USER}
                 ORDER BY p.id LIMIT 1)
             WHERE created_by_user_id IS NULL
               AND EXISTS (${CREATOR_OF_USER})`,
            { replacements: { admin: true } }
        );
    },

    // The rows it filled cannot be told apart from accounts created since, so
    // there is nothing safe to undo.
    async down() {},
};
