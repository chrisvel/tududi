'use strict';
const { Sequelize, DataTypes } = require('sequelize');
const migration = require('../../migrations/20261011000001-ltd-goal-planning');
const { resolveDatabaseSettings } = require('../../config/database-settings');
const pgDescribe = process.env.DATABASE_URL ? describe : describe.skip;

pgDescribe('Phase 4 PostgreSQL upgrade from original season/year enum', () => {
    let admin, db, databaseName;
    beforeAll(async () => {
        const settings = resolveDatabaseSettings(
            { DATABASE_URL: process.env.DATABASE_URL },
            null
        );
        const options = {
            dialect: 'postgres',
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: settings.password,
            logging: false,
            ...(settings.ssl ? { dialectOptions: { ssl: settings.ssl } } : {}),
        };
        databaseName = `ltd_phase4_legacy_${process.pid}`;
        admin = new Sequelize({
            ...options,
            database: process.env.DB_ADMIN_DATABASE || 'postgres',
        });
        await admin.query(`CREATE DATABASE "${databaseName}"`);
        db = new Sequelize({ ...options, database: databaseName });
        const qi = db.getQueryInterface();
        const id = {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        };
        await qi.createTable('users', { id });
        await qi.createTable('goals', {
            id,
            horizon: {
                type: DataTypes.ENUM('season', 'year'),
                defaultValue: 'season',
                allowNull: false,
            },
        });
        await qi.createTable('tasks', { id });
        await qi.createTable('projects', { id });
        await db.query("INSERT INTO goals(horizon) VALUES ('season'),('year')");
    });
    afterAll(async () => {
        if (db) await db.close();
        if (admin) {
            if (databaseName)
                await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            await admin.close();
        }
    });
    it('extends the enum idempotently, preserving rows, default, foreign keys and exactly the new phase tables', async () => {
        const qi = db.getQueryInterface();
        await migration.up(qi, Sequelize);
        await migration.up(qi, Sequelize);
        const [old] = await db.query(
            'SELECT id,horizon FROM goals ORDER BY id'
        );
        expect(old.map((goal) => goal.horizon)).toEqual(['season', 'year']);
        const [added] = await db.query(
            "INSERT INTO goals(horizon) VALUES ('vision'),('five_year'),('month'),('week') RETURNING horizon"
        );
        expect(added.map((goal) => goal.horizon)).toEqual([
            'vision',
            'five_year',
            'month',
            'week',
        ]);
        const [defaults] = await db.query(
            'INSERT INTO goals DEFAULT VALUES RETURNING horizon'
        );
        expect(defaults[0].horizon).toBe('season');
        await db.query('UPDATE goals SET parent_goal_id=1 WHERE id=2');
        await db.query('DELETE FROM goals WHERE id=1');
        const [child] = await db.query(
            'SELECT parent_goal_id FROM goals WHERE id=2'
        );
        expect(child[0].parent_goal_id).toBeNull();
        for (const table of ['tasks', 'projects']) {
            expect((await qi.describeTable(table)).goal_id.allowNull).toBe(
                true
            );
            expect(
                (await qi.showIndex(table)).some((index) =>
                    index.fields.some((field) => field.attribute === 'goal_id')
                )
            ).toBe(true);
        }
        expect((await qi.showAllTables()).sort()).toEqual([
            'goals',
            'ltd_goal_metrics',
            'ltd_journal',
            'ltd_metric_checkins',
            'projects',
            'tasks',
            'users',
        ]);
    });
});
