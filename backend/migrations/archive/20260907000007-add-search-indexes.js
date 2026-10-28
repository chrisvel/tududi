'use strict';

const {
    ensureSearchIndexes,
    dropSearchIndexes,
} = require('../utils/searchIndexes');

// PostgreSQL only: trigram indexes for the LOWER(col) LIKE searches and an
// index on session expiry. Nothing to do on SQLite.
module.exports = {
    async up(queryInterface) {
        await ensureSearchIndexes(queryInterface.sequelize);
    },

    async down(queryInterface) {
        await dropSearchIndexes(queryInterface.sequelize);
    },
};
