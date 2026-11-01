'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// One row per relation; the inverse (blocked_by, duplicated_by) is computed
// on read. Purely additive: no existing table is touched.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'task_relations', {
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
            source_task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            target_task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            relation_type: {
                type: Sequelize.STRING,
                allowNull: false,
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

        await addIndexOnce(
            queryInterface,
            'task_relations',
            ['source_task_id', 'target_task_id', 'relation_type'],
            { unique: true, name: 'task_relations_source_target_type' }
        );
        await addIndexOnce(
            queryInterface,
            'task_relations',
            ['target_task_id'],
            { name: 'task_relations_target_task_id' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('task_relations');
    },
};
