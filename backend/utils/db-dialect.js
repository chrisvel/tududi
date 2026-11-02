'use strict';

const { Op } = require('sequelize');

// Case-insensitive LIKE.
function ciLike(pattern) {
    return { [Op.iLike]: pattern };
}

// Empties the given tables. Intended for tests and seed scripts.
// Rows are deleted with constraints enforced, so pass the tables children
// first (join tables before tasks, tasks before users, ...).
// DELETE is used rather than TRUNCATE because TRUNCATE takes exclusive locks
// and is far slower on many small tables.
async function truncateTables(sequelize, tableNames) {
    for (const tableName of tableNames) {
        await sequelize.query(`DELETE FROM "${tableName}"`);
    }
}

module.exports = {
    ciLike,
    truncateTables,
};
