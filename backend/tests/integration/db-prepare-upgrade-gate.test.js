const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../../models');

// An existing database is only taken over by 2.0 once the final 1.x release
// has run all of its migrations: the newest archived migration must be in
// SequelizeMeta. db-prepare is spawned against this worker's database, which
// setup.js has already filled with tables, so it is never seen as fresh.

const BACKEND_DIR = path.join(__dirname, '..', '..');
const DB_PREPARE = path.join(BACKEND_DIR, 'scripts', 'db-prepare.js');
const lastV1Migration = fs
    .readdirSync(path.join(BACKEND_DIR, 'migrations', 'archive'))
    .filter((file) => file.endsWith('.js'))
    .sort()
    .pop();

function runPrepare() {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [DB_PREPARE], {
            cwd: BACKEND_DIR,
            env: { ...process.env, TUDUDI_ALLOW_DIALECT_SWITCH: 'true' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => (stdout += data));
        child.stderr.on('data', (data) => (stderr += data));
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

describe('db-prepare upgrade gate', () => {
    beforeEach(async () => {
        await sequelize.query('DROP TABLE IF EXISTS "SequelizeMeta"');
        await sequelize.query(
            'CREATE TABLE "SequelizeMeta" (name VARCHAR(255) PRIMARY KEY)'
        );
    });

    afterAll(async () => {
        await sequelize.query('DROP TABLE IF EXISTS "SequelizeMeta"');
    });

    it('refuses a database that never ran the final 1.x migrations', async () => {
        await sequelize.query(
            `INSERT INTO "SequelizeMeta" (name) VALUES ('20250101000000-older.js')`
        );

        const result = await runPrepare();

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('older tududi 1.x release');
        expect(result.stderr).toContain(lastV1Migration);
    }, 30000);

    it('takes over a database that is on the final 1.x release', async () => {
        await sequelize.query(
            'INSERT INTO "SequelizeMeta" (name) VALUES (:name)',
            { replacements: { name: lastV1Migration } }
        );

        const result = await runPrepare();

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Existing database detected');
    }, 30000);
});
