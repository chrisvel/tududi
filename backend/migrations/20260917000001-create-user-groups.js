'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

// safeAddIndex skips an index when any of its columns is already indexed, so
// every index here is added directly and guarded by name.
async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'user_groups', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING(15),
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
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

        await safeCreateTable(queryInterface, 'user_group_members', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            group_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'user_groups', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            added_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
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
        await addIndexOnce(
            queryInterface,
            'user_group_members',
            ['group_id', 'user_id'],
            { unique: true, name: 'user_group_members_group_user' }
        );
        await addIndexOnce(queryInterface, 'user_group_members', ['user_id'], {
            name: 'user_group_members_user_id',
        });

        await safeCreateTable(queryInterface, 'group_shares', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            group_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'user_groups', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            resource_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            resource_uid: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            access_level: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            granted_by_user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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
        await addIndexOnce(
            queryInterface,
            'group_shares',
            ['group_id', 'resource_type', 'resource_uid'],
            { unique: true, name: 'group_shares_group_resource' }
        );
        await addIndexOnce(
            queryInterface,
            'group_shares',
            ['resource_type', 'resource_uid'],
            { name: 'group_shares_resource' }
        );

        await safeCreateTable(queryInterface, 'group_permissions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            group_share_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'group_shares', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            resource_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            resource_uid: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            access_level: {
                type: Sequelize.STRING,
                allowNull: false,
            },
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
            status: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'accepted',
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
        await addIndexOnce(
            queryInterface,
            'group_permissions',
            ['group_share_id', 'user_id', 'resource_type', 'resource_uid'],
            { unique: true, name: 'group_permissions_share_user_resource' }
        );
        await addIndexOnce(queryInterface, 'group_permissions', ['user_id'], {
            name: 'group_permissions_user_id',
        });
        await addIndexOnce(
            queryInterface,
            'group_permissions',
            ['resource_type', 'resource_uid'],
            { name: 'group_permissions_resource' }
        );
        await addIndexOnce(
            queryInterface,
            'group_permissions',
            ['user_id', 'status'],
            { name: 'group_permissions_user_status' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('group_permissions');
        await queryInterface.dropTable('group_shares');
        await queryInterface.dropTable('user_group_members');
        await queryInterface.dropTable('user_groups');
    },
};
