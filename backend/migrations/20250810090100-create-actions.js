'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('actions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            actor_user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            verb: { type: Sequelize.STRING, allowNull: false },
            resource_type: { type: Sequelize.STRING, allowNull: false },
            resource_uid: { type: Sequelize.STRING, allowNull: false },
            target_user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            access_level: { type: Sequelize.STRING, allowNull: true },
            metadata: { type: Sequelize.JSON, allowNull: true },
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

        await queryInterface.addIndex('actions', [
            'resource_type',
            'resource_uid',
        ]);
        await queryInterface.addIndex('actions', ['target_user_id']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('actions');
    },
};
