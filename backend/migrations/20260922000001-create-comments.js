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
    // Comments on tasks, with an optional list of mentioned people (uids)
    // recorded alongside the text so a mention notification can be sent
    // without parsing the body. Purely additive: no existing table is touched.
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'comments', {
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
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
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
            body: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            mentioned_person_uids: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
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

        await addIndexOnce(queryInterface, 'comments', ['task_id'], {
            name: 'comments_task_id',
        });
        await addIndexOnce(queryInterface, 'comments', ['user_id'], {
            name: 'comments_user_id',
        });
        await addIndexOnce(
            queryInterface,
            'comments',
            ['task_id', 'created_at'],
            { name: 'comments_task_id_created_at' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('comments');
    },
};
