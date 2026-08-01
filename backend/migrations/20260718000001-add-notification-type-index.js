'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface) {
        await safeAddIndex(
            queryInterface,
            'notifications',
            ['user_id', 'type', 'created_at'],
            { name: 'notifications_user_type_created_at_idx' }
        );
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeIndex(
                'notifications',
                'notifications_user_type_created_at_idx'
            );
        } catch (error) {
            console.log(
                'Index notifications_user_type_created_at_idx not found, skipping removal'
            );
        }
    },
};
