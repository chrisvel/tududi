'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('people', {
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
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            relationship_type: {
                type: Sequelize.STRING(50),
                allowNull: true,
                defaultValue: 'other',
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            phone: {
                type: Sequelize.STRING(50),
                allowNull: true,
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            archived: {
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

        await queryInterface.addIndex('people', ['user_id', 'archived'], {
            name: 'people_user_archived_idx',
        });
        await queryInterface.addIndex('people', ['user_id', 'name'], {
            name: 'people_user_name_idx',
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('people', 'people_user_name_idx');
        await queryInterface.removeIndex('people', 'people_user_archived_idx');
        await queryInterface.dropTable('people');
    },
};
