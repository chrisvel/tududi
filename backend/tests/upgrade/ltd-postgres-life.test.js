'use strict';
const { Sequelize, DataTypes } = require('sequelize');
const migration = require('../../migrations/20261012100000-create-ltd-milestones');
const { resolveDatabaseSettings } = require('../../config/database-settings');
const pgDescribe = process.env.DATABASE_URL ? describe : describe.skip;

// LTD-PATCH(T-601): Phase 6 additive migration on an existing PostgreSQL schema.
pgDescribe('Phase 6 PostgreSQL upgrade', () => {
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
        databaseName = `ltd_phase6_legacy_${process.pid}`;
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
            title: { type: DataTypes.STRING, allowNull: false },
        });
        await db.query('INSERT INTO users DEFAULT VALUES');
        await db.query("INSERT INTO goals(title) VALUES ('old')");
    });
    afterAll(async () => {
        if (db) await db.close();
        if (admin) {
            if (databaseName)
                await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            await admin.close();
        }
    });
    it('creates ltd_milestones idempotently with enum checks and FK actions', async () => {
        const qi = db.getQueryInterface();
        await migration.up(qi, Sequelize);
        await migration.up(qi, Sequelize);
        const [goals] = await db.query('SELECT title FROM goals');
        expect(goals).toEqual([{ title: 'old' }]);
        await db.query(
            "INSERT INTO ltd_milestones(uid,user_id,title,date,goal_id,created_at,updated_at) VALUES ('m1',1,'t','2020-01-01',1,NOW(),NOW())"
        );
        await expect(
            db.query(
                "INSERT INTO ltd_milestones(uid,user_id,title,date,date_precision,created_at,updated_at) VALUES ('m2',1,'t','2020-01-01','week',NOW(),NOW())"
            )
        ).rejects.toThrow();
        await db.query('DELETE FROM goals WHERE id=1');
        const [rows] = await db.query(
            'SELECT goal_id, date_precision, kind, date::text AS date FROM ltd_milestones'
        );
        expect(rows).toEqual([
            {
                goal_id: null,
                date_precision: 'day',
                kind: 'life_event',
                date: '2020-01-01',
            },
        ]);
        await db.query('DELETE FROM users WHERE id=1');
        const [[{ n }]] = await db.query(
            'SELECT COUNT(*)::int AS n FROM ltd_milestones'
        );
        expect(n).toBe(0);
        expect((await qi.showAllTables()).sort()).toEqual([
            'goals',
            'ltd_milestones',
            'users',
        ]);
        await expect(migration.down()).rejects.toThrow(/additive/);
    });
});
