'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

// Every account gets one free Untangle of its own list. The key is a hash
// of the text it was spent on, so answering the questions and re-running
// on the same text stays free, and a new list is a new (paid) request.
// Null for every existing account, so they all get theirs.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'untangle_free_key',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'untangle_free_key');
    },
};
