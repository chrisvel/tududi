const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { getConfig } = require('../../config/config');
const { pendingMigrations } = require('../../services/healthService');

describe('Health endpoints', () => {
    const config = getConfig();

    afterEach(() => {
        config.hosted.enabled = false;
    });

    it('GET /api/health is a liveness probe', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
        expect(res.body.environment).toBe('test');
    });

    it('hides deployment details on a hosted instance', async () => {
        config.hosted.enabled = true;
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('environment');
        expect(res.body).not.toHaveProperty('trustProxy');
    });

    it('GET /api/health/ready checks the database and migrations', async () => {
        // The test schema comes from sync(), so SequelizeMeta may not exist;
        // create it and record every migration so the state is "current".
        const qi = sequelize.getQueryInterface();
        const tables = await qi.showAllTables();
        if (!tables.includes('SequelizeMeta')) {
            await qi.createTable('SequelizeMeta', {
                name: { type: 'VARCHAR(255)', primaryKey: true },
            });
        }
        const pendingBefore = await pendingMigrations();
        for (const name of pendingBefore) {
            await sequelize.query(
                'INSERT INTO "SequelizeMeta" (name) VALUES (:name)',
                { replacements: { name } }
            );
        }

        const res = await request(app).get('/api/health/ready');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('ok');
        expect(res.body.pendingMigrations).toEqual([]);
        expect(typeof res.body.databaseLatencyMs).toBe('number');
    });

    it('reports pending migrations as degraded', async () => {
        await sequelize.query(
            'DELETE FROM "SequelizeMeta" WHERE name = (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1)'
        );

        const res = await request(app).get('/api/health/ready');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('degraded');
        expect(res.body.pendingMigrations).toHaveLength(1);
    });

    it('is served under the versioned base path too', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.status).toBe(200);
    });
});
