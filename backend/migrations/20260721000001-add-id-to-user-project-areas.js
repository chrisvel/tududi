'use strict';

module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('user_project_areas')) return;

        const tableInfo = await queryInterface.describeTable('user_project_areas');
        if ('id' in tableInfo) return;

        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        try {
            await queryInterface.sequelize.query(
                'DROP TABLE IF EXISTS user_project_areas_new;'
            );
            await queryInterface.sequelize.query(`
                CREATE TABLE user_project_areas_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await queryInterface.sequelize.query(`
                INSERT INTO user_project_areas_new (user_id, project_id, area_id, created_at, updated_at)
                SELECT user_id, project_id, area_id, created_at, updated_at
                FROM user_project_areas;
            `);
            await queryInterface.sequelize.query('DROP TABLE user_project_areas;');
            await queryInterface.sequelize.query(
                'ALTER TABLE user_project_areas_new RENAME TO user_project_areas;'
            );
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
        }

        await queryInterface.addIndex('user_project_areas', ['user_id']);
        await queryInterface.addIndex('user_project_areas', ['project_id']);
        await queryInterface.addIndex(
            'user_project_areas',
            ['user_id', 'project_id'],
            { unique: true, name: 'user_project_areas_user_project_unique' }
        );
    },

    async down(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('user_project_areas')) return;

        const tableInfo = await queryInterface.describeTable('user_project_areas');
        if (!('id' in tableInfo)) return;

        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        try {
            await queryInterface.sequelize.query(
                'DROP TABLE IF EXISTS user_project_areas_old;'
            );
            await queryInterface.sequelize.query(`
                CREATE TABLE user_project_areas_old (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, project_id)
                );
            `);
            await queryInterface.sequelize.query(`
                INSERT INTO user_project_areas_old (user_id, project_id, area_id, created_at, updated_at)
                SELECT user_id, project_id, area_id, created_at, updated_at
                FROM user_project_areas;
            `);
            await queryInterface.sequelize.query(
                'DROP TABLE user_project_areas;'
            );
            await queryInterface.sequelize.query(
                'ALTER TABLE user_project_areas_old RENAME TO user_project_areas;'
            );
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
        }
    },
};
