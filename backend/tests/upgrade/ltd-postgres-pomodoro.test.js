'use strict';
const { Sequelize, DataTypes } = require('sequelize');
const migration = require('../../migrations/20261017000001-ltd-task-pomodoro');
const { resolveDatabaseSettings } = require('../../config/database-settings');
const pgDescribe = process.env.DATABASE_URL ? describe : describe.skip;
pgDescribe('Phase 12 PostgreSQL legacy upgrade', () => {
    let admin, db, name;
    beforeAll(async () => {
        const config = resolveDatabaseSettings(
            { DATABASE_URL: process.env.DATABASE_URL },
            null
        );
        const options = {
            dialect: 'postgres',
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            logging: false,
        };
        name = `ltd_phase12_legacy_${process.pid}`;
        admin = new Sequelize({ ...options, database: 'postgres' });
        await admin.query(`CREATE DATABASE "${name}"`);
        db = new Sequelize({ ...options, database: name });
        const qi = db.getQueryInterface();
        await qi.createTable('tasks', {
            id: { type: DataTypes.INTEGER, primaryKey: true },
            estimated_minutes: DataTypes.INTEGER,
        });
        await qi.createTable('ltd_focus_sessions', {
            id: { type: DataTypes.INTEGER, primaryKey: true },
            user_id: DataTypes.INTEGER,
            task_id: DataTypes.INTEGER,
        });
        await db.query(
            'INSERT INTO tasks(id, estimated_minutes) VALUES (1, 50)'
        );
    });
    afterAll(async () => {
        if (db) await db.close();
        if (admin) {
            await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
            await admin.close();
        }
    });
    it('adds a nullable INTEGER with no default, preserves the estimate, and adds the combined index idempotently', async () => {
        const qi = db.getQueryInterface();
        await migration.up(qi, Sequelize);
        await migration.up(qi, Sequelize);
        expect((await qi.describeTable('tasks')).focus_minutes).toMatchObject({
            type: 'INTEGER',
            allowNull: true,
            defaultValue: null,
        });
        const [rows] = await db.query('SELECT * FROM tasks');
        expect(rows).toEqual([
            { id: 1, estimated_minutes: 50, focus_minutes: null },
        ]);
        const indexes = await qi.showIndex('ltd_focus_sessions');
        expect(
            indexes.some(
                (i) =>
                    i.fields.map((f) => f.attribute).join(',') ===
                    'user_id,task_id'
            )
        ).toBe(true);
        await expect(migration.down()).rejects.toThrow('additive');
    });
});
