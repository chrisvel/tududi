'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('goals', {
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
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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
            title: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            why: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            horizon: {
                type: Sequelize.ENUM('season', 'year'),
                allowNull: false,
                defaultValue: 'season',
            },
            target_date: {
                type: Sequelize.DATEONLY,
                allowNull: true,
            },
            status: {
                type: Sequelize.ENUM('active', 'achieved', 'paused', 'dropped'),
                allowNull: false,
                defaultValue: 'active',
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

        await queryInterface.addIndex('goals', ['area_id'], {
            name: 'goals_area_id_idx',
        });
        await queryInterface.addIndex('goals', ['user_id'], {
            name: 'goals_user_id_idx',
        });
        await queryInterface.addIndex('goals', ['status'], {
            name: 'goals_status_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('goals', 'goals_status_idx');
        await queryInterface.removeIndex('goals', 'goals_user_id_idx');
        await queryInterface.removeIndex('goals', 'goals_area_id_idx');
        await queryInterface.dropTable('goals');
    },
};
