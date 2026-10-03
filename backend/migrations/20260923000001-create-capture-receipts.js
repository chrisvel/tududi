'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'capture_receipts', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            request_key: { type: Sequelize.STRING(64), allowNull: false },
            fingerprint: { type: Sequelize.STRING(64), allowNull: false },
            result: { type: Sequelize.JSON, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });
        const indexes = await queryInterface.showIndex('capture_receipts');
        if (
            !indexes.some(
                (index) => index.name === 'capture_receipts_user_request'
            )
        ) {
            await queryInterface.addIndex(
                'capture_receipts',
                ['user_id', 'request_key'],
                {
                    name: 'capture_receipts_user_request',
                    unique: true,
                }
            );
        }
    },
    async down(queryInterface) {
        await queryInterface.dropTable('capture_receipts');
    },
};
