'use strict';

const {
    safeAddColumns,
    safeAddIndex,
    safeRemoveColumn,
} = require('../utils/migration-utils');
const { canonicalEmail } = require('../services/emailDomainService');

module.exports = {
    // Cloud trials start on email verification and end in a read-only month,
    // and sign-ups are matched by mailbox, so "a.b+1@gmail.com" cannot open a
    // second trial next to "ab@gmail.com".
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'billing_accounts', [
            {
                name: 'trial_started_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'email_canonical',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
        ]);
        await safeAddIndex(queryInterface, 'users', ['email_canonical'], {
            name: 'users_email_canonical',
        });

        const users = await queryInterface.sequelize.query(
            'SELECT id, email FROM users WHERE email IS NOT NULL',
            { type: Sequelize.QueryTypes.SELECT }
        );
        for (const user of users) {
            await queryInterface.bulkUpdate(
                'users',
                { email_canonical: canonicalEmail(user.email) },
                { id: user.id }
            );
        }
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeIndex('users', 'users_email_canonical');
        } catch {
            // never created
        }
        await safeRemoveColumn(queryInterface, 'users', 'email_canonical');
        await safeRemoveColumn(
            queryInterface,
            'billing_accounts',
            'trial_started_at'
        );
    },
};
