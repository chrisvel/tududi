'use strict';

module.exports = {
    async up(queryInterface) {
        const indexes = await queryInterface.showIndex('notifications');
        const indexName = 'notifications_user_type_created_at_idx';

        if (!indexes.some((idx) => idx.name === indexName)) {
            await queryInterface.addIndex(
                'notifications',
                ['user_id', 'type', 'created_at'],
                { name: indexName }
            );
        }
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
