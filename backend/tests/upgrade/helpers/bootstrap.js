const { spawn } = require('child_process');
const path = require('path');
const { BACKEND_DIR } = require('./fixtures');

// Environment that pins a child process to a SQLite file regardless of what
// the developer's .env or shell says. dotenv never overrides keys that are
// already set, so the empty strings win over a Postgres DATABASE_URL.
function sqliteEnv(dbFile, extra = {}) {
    return {
        ...process.env,
        NODE_ENV: 'production',
        DB_FILE: dbFile,
        DATABASE_URL: '',
        DB_DIALECT: '',
        DISABLE_SCHEDULER: 'true',
        DISABLE_TELEGRAM: 'true',
        SEQUELIZE_LOGGING: 'false',
        ...extra,
    };
}

function run(command, args, env, cwd = BACKEND_DIR) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

const SEQUELIZE_CLI = path.join(
    BACKEND_DIR,
    '..',
    'node_modules',
    '.bin',
    'sequelize'
);

// Mirrors the database steps of cmd/start.sh.
async function runPrepare(dbFile, extraEnv) {
    return run('node', ['scripts/db-prepare.js'], sqliteEnv(dbFile, extraEnv));
}

async function runMigrate(dbFile, extraEnv) {
    return run(
        SEQUELIZE_CLI,
        ['db:migrate', '--config', 'config/database.js'],
        sqliteEnv(dbFile, extraEnv)
    );
}

async function runUserCreate(dbFile, email, password, admin = false) {
    return run(
        'node',
        ['scripts/user-create.js', email, password, String(admin)],
        sqliteEnv(dbFile)
    );
}

async function runBootstrap(dbFile, extraEnv = {}) {
    const prepare = await runPrepare(dbFile, extraEnv);
    if (prepare.code !== 0) {
        return { prepare, migrate: null };
    }
    const migrate = await runMigrate(dbFile, extraEnv);
    return { prepare, migrate };
}

async function runSync(dbFile) {
    return run('node', ['scripts/db-sync.js'], sqliteEnv(dbFile));
}

// Boots the app in a fresh process against the file and returns the JSON
// report printed by tests/upgrade/helpers/smoke-runner.js.
async function runSmoke(dbFile) {
    const result = await run(
        'node',
        [path.join(__dirname, 'smoke-runner.js')],
        sqliteEnv(dbFile, { NODE_ENV: 'test' })
    );
    if (result.code !== 0) {
        throw new Error(describeResult('smoke-runner', result));
    }
    const lines = result.stdout.trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
}

function describeResult(label, result) {
    if (!result) return `${label}: not run`;
    return `${label}: exit ${result.code}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`;
}

module.exports = {
    sqliteEnv,
    run,
    runPrepare,
    runMigrate,
    runUserCreate,
    runBootstrap,
    runSync,
    runSmoke,
    describeResult,
};
