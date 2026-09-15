const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// scripts/with-db-lock.js wraps db-prepare.js and takes a PostgreSQL advisory
// lock before running it. It must not attempt that connection at all when the
// dialect-switch guard would refuse to start: the guard has to run first, or
// an operator only ever sees a bare "could not take the schema lock" error
// instead of the actual reason PostgreSQL was rejected.

const SCRIPT_DIR = path.join(__dirname, '..', '..', '..', 'scripts');
const WITH_DB_LOCK = path.join(SCRIPT_DIR, 'with-db-lock.js');
const DB_PREPARE = path.join(SCRIPT_DIR, 'db-prepare.js');
const UNREACHABLE_PG = 'postgres://nobody:nothing@127.0.0.1:1/none';

function runWithDbLock(extraEnv) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, NODE_ENV: 'production', ...extraEnv };
        delete env.DB_DIALECT;
        const child = spawn('node', [WITH_DB_LOCK, 'node', DB_PREPARE], {
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

describe('with-db-lock dialect switch guard', () => {
    let dir;
    let populated;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-lock-guard-'));
        populated = path.join(dir, 'populated.sqlite3');
        fs.writeFileSync(populated, Buffer.alloc(8192, 1));
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('refuses to start over a populated SQLite file before taking the schema lock', async () => {
        const result = await runWithDbLock({
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
        });
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('existing SQLite database was found');
        expect(result.stdout).not.toContain('Waiting for the schema lock');
        expect(result.stderr).not.toContain('Could not take the schema lock');
    }, 30000);
});
