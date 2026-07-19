'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'permissions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            resource_type: { type: Sequelize.STRING, allowNull: false },
            resource_uid: { type: Sequelize.STRING, allowNull: false },
            access_level: { type: Sequelize.STRING, allowNull: false },
            propagation: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'direct',
            },
            granted_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            source_action_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'actions', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
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

        try {
            await queryInterface.addConstraint('permissions', {
                fields: ['user_id', 'resource_type', 'resource_uid'],
                type: 'unique',
                name: 'uniq_permissions_user_resource',
            });
        } catch (e) {
            console.log(
                'Constraint uniq_permissions_user_resource may already exist, skipping'
            );
        }

        await safeAddIndex(queryInterface, 'permissions', [
            'resource_type',
            'resource_uid',
        ]);
        await safeAddIndex(queryInterface, 'permissions', ['user_id']);
        await safeAddIndex(queryInterface, 'permissions', ['access_level']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('permissions');
    },
};
