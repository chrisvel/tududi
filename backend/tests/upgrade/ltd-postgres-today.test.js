'use strict';
const { Sequelize, DataTypes } = require('sequelize');
const migration = require('../../migrations/20261012000001-ltd-today-execution');
const { resolveDatabaseSettings } = require('../../config/database-settings');
const pgDescribe = process.env.DATABASE_URL ? describe : describe.skip;

// LTD-PATCH(T-502): Phase 5 additive migration on an existing PostgreSQL schema.
pgDescribe('Phase 5 PostgreSQL upgrade', () => {
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
        databaseName = `ltd_phase5_legacy_${process.pid}`;
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
        await qi.createTable('tasks', {
            id,
            name: { type: DataTypes.STRING, allowNull: false },
        });
        await db.query('INSERT INTO users DEFAULT VALUES');
        await db.query("INSERT INTO tasks(name) VALUES ('old')");
    });
    afterAll(async () => {
        if (db) await db.close();
        if (admin) {
            if (databaseName)
                await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            await admin.close();
        }
    });
    it('adds starter_step and ltd_focus_sessions idempotently, preserving rows', async () => {
        const qi = db.getQueryInterface();
        await migration.up(qi, Sequelize);
        await migration.up(qi, Sequelize);
        const [rows] = await db.query('SELECT name, starter_step FROM tasks');
        expect(rows).toEqual([{ name: 'old', starter_step: null }]);
        expect((await qi.describeTable('tasks')).starter_step.allowNull).toBe(
            true
        );
        await db.query(
            "INSERT INTO ltd_focus_sessions(uid,user_id,task_id,started_at,planned_minutes) VALUES ('s1',1,1,NOW(),25)"
        );
        await db.query('DELETE FROM tasks WHERE id=1');
        const [sessions] = await db.query(
            'SELECT task_id, interrupted FROM ltd_focus_sessions'
        );
        expect(sessions).toEqual([{ task_id: null, interrupted: false }]);
        expect((await qi.showAllTables()).sort()).toEqual([
            'ltd_focus_sessions',
            'tasks',
            'users',
        ]);
        await expect(migration.down()).rejects.toThrow(/additive/);
    });
});
