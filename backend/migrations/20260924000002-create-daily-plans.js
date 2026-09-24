'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

module.exports = {
    // One plan per user per local date, holding the tasks picked for that
    // day in order, optionally placed in a time slot. Purely additive.
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'daily_plans', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            plan_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            started_at: {
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

        await addIndexOnce(
            queryInterface,
            'daily_plans',
            ['user_id', 'plan_date'],
            { name: 'daily_plans_user_id_plan_date', unique: true }
        );

        await safeCreateTable(queryInterface, 'daily_plan_items', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            daily_plan_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'daily_plans', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            position: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            start_minute: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            duration_minutes: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 30,
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
            'daily_plan_items',
            ['daily_plan_id', 'task_id'],
            { name: 'daily_plan_items_plan_id_task_id', unique: true }
        );
        await addIndexOnce(queryInterface, 'daily_plan_items', ['task_id'], {
            name: 'daily_plan_items_task_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('daily_plan_items');
        await queryInterface.dropTable('daily_plans');
    },
};
