'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('supporter_licenses', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            license_key: {
                type: Sequelize.STRING(64),
                allowNull: false,
                unique: true,
            },
            tier: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'bronze',
                comment: 'bronze, silver, or gold',
            },
            purchase_amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
                comment: 'Optional amount in USD',
            },
            activated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Null = lifetime license',
            },
            revoked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await queryInterface.addIndex('supporter_licenses', ['user_id']);
        await queryInterface.addIndex('supporter_licenses', ['license_key'], {
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('supporter_licenses');
    },
};
