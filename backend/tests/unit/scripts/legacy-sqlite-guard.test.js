const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// tududi 2.0 must refuse to start while a 1.x SQLite file still holds data,
// before it tries to reach PostgreSQL: otherwise the operator only sees an
// empty instance or a bare connection error. The scripts are spawned so their
// config is built from a controlled environment, and the PostgreSQL URL points
// at a closed port so the only difference between outcomes is the guard.

const BACKEND_DIR = path.join(__dirname, '..', '..', '..');
const DB_PREPARE = path.join(BACKEND_DIR, 'scripts', 'db-prepare.js');
const WITH_DB_LOCK = path.join(BACKEND_DIR, 'scripts', 'with-db-lock.js');
const UNREACHABLE_PG = 'postgres://nobody:nothing@127.0.0.1:1/none';
const GUARD_MESSAGE = 'A tududi 1.x SQLite database was found';

function run(args, extraEnv) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, NODE_ENV: 'production' };
        for (const key of [
            'DATABASE_URL',
            'DB_DIALECT',
            'DB_HOST',
            'DB_FILE',
            'TUDUDI_ALLOW_DIALECT_SWITCH',
        ]) {
            delete env[key];
        }
        Object.assign(env, extraEnv);
        const child = spawn('node', args, {
            cwd: BACKEND_DIR,
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

describe('leftover SQLite guard', () => {
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

    it('refuses to prepare the database over a populated SQLite file', async () => {
        const result = await run([DB_PREPARE], {
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
        });
        expect(result.code).toBe(1);
        expect(result.stderr).toContain(GUARD_MESSAGE);
        expect(result.stderr).toContain(populated);
        expect(result.stderr).toContain('30-moving-to-postgres.md');
        expect(result.stderr).toContain('TUDUDI_ALLOW_DIALECT_SWITCH=true');
        expect(result.stderr).not.toContain('Database preparation failed');
    }, 30000);

    it('proceeds to the connection when the override is set', async () => {
        const result = await run([DB_PREPARE], {
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
            TUDUDI_ALLOW_DIALECT_SWITCH: 'true',
        });
        expect(result.code).toBe(1);
        expect(result.stderr).not.toContain(GUARD_MESSAGE);
        expect(result.stderr).toContain('Database preparation failed');
    }, 30000);

    it('ignores an empty or missing SQLite file', async () => {
        for (const file of [empty, path.join(dir, 'missing.sqlite3')]) {
            const result = await run([DB_PREPARE], {
                DATABASE_URL: UNREACHABLE_PG,
                DB_FILE: file,
            });
            expect(result.code).toBe(1);
            expect(result.stderr).not.toContain(GUARD_MESSAGE);
            expect(result.stderr).toContain('Database preparation failed');
        }
    }, 60000);

    it('refuses before taking the schema lock', async () => {
        const result = await run([WITH_DB_LOCK, 'node', DB_PREPARE], {
            DATABASE_URL: UNREACHABLE_PG,
            DB_FILE: populated,
        });
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain(GUARD_MESSAGE);
        expect(result.stdout).not.toContain('Waiting for the schema lock');
    }, 30000);

    it('names the SQLite file when no database is configured', async () => {
        const result = await run([DB_PREPARE], { DB_FILE: populated });
        expect(result.code).toBe(1);
        expect(result.stderr).toContain(GUARD_MESSAGE);
    }, 30000);

    it('asks for DATABASE_URL when nothing is configured', async () => {
        const result = await run([DB_PREPARE], {
            DB_FILE: path.join(dir, 'missing.sqlite3'),
        });
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('No database configured');
        expect(result.stderr).not.toContain(GUARD_MESSAGE);
    }, 30000);
});
