'use strict';
const { Sequelize, DataTypes } = require('sequelize');
const migration = require('../../migrations/20261016000001-ltd-lessons');
const { resolveDatabaseSettings } = require('../../config/database-settings');
const pgDescribe = process.env.DATABASE_URL ? describe : describe.skip;

// LTD-PATCH(T-1102): Phase 11 additive migration on an existing PostgreSQL schema.
pgDescribe('Phase 11 PostgreSQL upgrade', () => {
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
        databaseName = `ltd_phase11_legacy_${process.pid}`;
        admin = new Sequelize({
            ...options,
            database: process.env.DB_ADMIN_DATABASE || 'postgres',
        });
        await admin.query(`CREATE DATABASE "${databaseName}"`);
        db = new Sequelize({ ...options, database: databaseName });
        const qi = db.getQueryInterface();
        await qi.createTable('users', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
        });
        await db.query('INSERT INTO users DEFAULT VALUES');
    });
    afterAll(async () => {
        if (db) await db.close();
        if (admin) {
            if (databaseName)
                await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            await admin.close();
        }
    });
    it('creates the three lesson tables idempotently with checks, a unique link and cascades', async () => {
        const qi = db.getQueryInterface();
        await migration.up(qi, Sequelize);
        await migration.up(qi, Sequelize);
        expect((await qi.showAllTables()).sort()).toEqual([
            'ltd_lesson_checks',
            'ltd_lesson_links',
            'ltd_lessons',
            'users',
        ]);
        await db.query(
            "INSERT INTO ltd_lessons(uid,user_id,title,learned_on,created_at,updated_at) VALUES ('l1',1,'t','2026-10-01',NOW(),NOW())"
        );
        await expect(
            db.query(
                "INSERT INTO ltd_lessons(uid,user_id,title,learned_on,status,created_at,updated_at) VALUES ('l2',1,'t','2026-10-01','archived',NOW(),NOW())"
            )
        ).rejects.toThrow();
        await db.query(
            "INSERT INTO ltd_lesson_links(lesson_id,target_type,target_id) VALUES (1,'goal',7)"
        );
        await expect(
            db.query(
                "INSERT INTO ltd_lesson_links(lesson_id,target_type,target_id) VALUES (1,'goal',7)"
            )
        ).rejects.toThrow();
        await expect(
            db.query(
                "INSERT INTO ltd_lesson_links(lesson_id,target_type,target_id) VALUES (1,'note',7)"
            )
        ).rejects.toThrow();
        await db.query(
            "INSERT INTO ltd_lesson_checks(uid,lesson_id,checked_on,verdict,created_at) VALUES ('c1',1,'2026-10-13','holds',NOW())"
        );
        const [[row]] = await db.query(
            'SELECT status, review_on, learned_on::text AS learned_on FROM ltd_lessons'
        );
        expect(row).toEqual({
            status: 'active',
            review_on: null,
            learned_on: '2026-10-01',
        });
        await db.query('DELETE FROM users WHERE id=1');
        for (const table of [
            'ltd_lessons',
            'ltd_lesson_links',
            'ltd_lesson_checks',
        ]) {
            const [[{ n }]] = await db.query(
                `SELECT COUNT(*)::int AS n FROM ${table}`
            );
            expect(n).toBe(0);
        }
        await expect(migration.down()).rejects.toThrow(/additive/);
    });
});
