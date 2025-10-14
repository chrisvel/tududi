'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('views', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
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
            search_query: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            filters: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JSON array of entity type filters',
            },
            priority: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            due: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            is_pinned: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
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

        await queryInterface.addIndex('views', {
            fields: ['user_id'],
            name: 'views_user_id_index',
        });

        await queryInterface.addIndex('views', {
            fields: ['user_id', 'is_pinned'],
            name: 'views_user_pinned_index',
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('views');
    },
};
