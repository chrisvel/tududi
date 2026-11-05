'use strict';

const { safeChangeColumn, safeAddIndex } = require('../utils/migration-utils');

// SQLite has no ALTER COLUMN, so safeChangeColumn rebuilds the table there
// (create a new one, copy the rows, swap it in) and that rebuild doesn't
// carry indexes over. oidc_identities has a unique composite index on
// (provider_slug, subject) that must be restored afterwards, on every
// dialect, or duplicate identity links become possible on SQLite installs.
// safeAddIndex can't do it: it treats any index touching one of the target
// fields as a match, so it would see the pre-existing single-column
// provider_slug index and skip adding the composite one.
async function restoreIndexes(queryInterface) {
    await safeAddIndex(queryInterface, 'oidc_identities', ['user_id']);
    await safeAddIndex(queryInterface, 'oidc_identities', ['provider_slug']);
    await safeAddIndex(queryInterface, 'oidc_identities', ['email']);

    const indexes = await queryInterface.showIndex('oidc_identities');
    const hasCompositeUnique = indexes.some((index) => {
        const attrs = index.fields.map((f) => f.attribute);
        return (
            index.unique &&
            attrs.length === 2 &&
            attrs.includes('provider_slug') &&
            attrs.includes('subject')
        );
    });
    if (!hasCompositeUnique) {
        await queryInterface.addIndex(
            'oidc_identities',
            ['provider_slug', 'subject'],
            { unique: true, name: 'oidc_identities_provider_slug_subject' }
        );
    }
}

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'oidc_identities', 'picture', {
            type: Sequelize.TEXT('long'),
            allowNull: true,
        });
        await restoreIndexes(queryInterface);
    },

    async down(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'oidc_identities', 'picture', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await restoreIndexes(queryInterface);
    },
};
