const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// scripts/db-prepare.js must refuse to bring up PostgreSQL when the SQLite
// file this deployment would otherwise use still holds data. The script is
// spawned so its config is built from a controlled environment, and the
// PostgreSQL URL points at a closed port so the only difference between the
// two outcomes is whether the guard fired before the connection attempt.

const SCRIPT = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'scripts',
    'db-prepare.js'
);
const UNREACHABLE_PG = 'postgres://nobody:nothing@127.0.0.1:1/none';

function runPrepare(extraEnv) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, NODE_ENV: 'production', ...extraEnv };
        delete env.DB_DIALECT;
        const child = spawn('node', [SCRIPT], {
            cwd: path.join(__dirname, '..', '..', '..'),
            env,
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

describe('db-prepare dialect switch guard', () => {
    let dir;
    let populated;
    let empty;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-guard-'));
        populated = path.join(dir, 'populated.sqlite3');
        empty = path.join(dir, 'empty.sqlite3');
        fs.writeFileSync(populated, Buffer.alloc(8192, 1));
        fs.writeFileSync(empty, '');
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('refuses to start PostgreSQL over a populated SQLite file', async () => {
        const result = await runPrepare({
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
        });
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('existing SQLite database was found');
        expect(result.stderr).toContain(populated);
        expect(result.stderr).toContain('TUDUDI_ALLOW_DIALECT_SWITCH=true');
        expect(result.stderr).not.toContain('Database preparation failed');
    }, 30000);

    it('proceeds to the connection when the override is set', async () => {
        const result = await runPrepare({
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
            TUDUDI_ALLOW_DIALECT_SWITCH: 'true',
        });
        expect(result.code).toBe(1);
        expect(result.stderr).not.toContain(
            'existing SQLite database was found'
        );
        expect(result.stderr).toContain('Database preparation failed');
    }, 30000);

    it('ignores an empty SQLite file left by a failed first start', async () => {
        const result = await runPrepare({
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: empty,
        });
        expect(result.code).toBe(1);
        expect(result.stderr).not.toContain(
            'existing SQLite database was found'
        );
        expect(result.stderr).toContain('Database preparation failed');
    }, 30000);

    it('ignores a missing SQLite file', async () => {
        const result = await runPrepare({
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: path.join(dir, 'does-not-exist.sqlite3'),
        });
        expect(result.code).toBe(1);
        expect(result.stderr).not.toContain(
            'existing SQLite database was found'
        );
        expect(result.stderr).toContain('Database preparation failed');
    }, 30000);

    it('does not interfere with SQLite deployments', async () => {
        const result = await runPrepare({
            DATABASE_URL: '',
            DB_FILE: path.join(dir, 'fresh.sqlite3'),
        });
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Preparing sqlite database');
    }, 60000);
});
