// Guards against drift between the three ways a tududi schema comes to exist:
//   models   sequelize.sync() from backend/models (fresh PostgreSQL, and the
//            starting point of a fresh SQLite install)
//   fresh    sync() followed by every migration (fresh SQLite install)
//   legacy   an older release's database run through the pending migrations
//   postgres db-prepare on an empty PostgreSQL database (when DATABASE_URL
//            is set), i.e. sync() plus the baseline
//
// A column or unique constraint that exists in the models but not in an
// upgraded legacy database means a migration is missing and every existing
// install is broken. Known, accepted differences live in known-schema-drift.json.
// Run with SCHEMA_PARITY_REPORT=1 to print every difference without failing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { listFixtures, copyToTemp, removeTemp } = require('./helpers/fixtures');
const {
    runBootstrap,
    runSync,
    describeResult,
} = require('./helpers/bootstrap');
const {
    snapshotSqlite,
    snapshotPostgres,
    diffSnapshots,
    applyAllowlist,
    formatFindings,
} = require('./helpers/schema');

const allowlist = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'known-schema-drift.json'), 'utf8')
);
delete allowlist._comment;

const REPORT_ONLY = process.env.SCHEMA_PARITY_REPORT === '1';
const POSTGRES_URL = process.env.DATABASE_URL || '';

const targets = [];
const tempDirs = [];

function emptyTempFile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-parity-'));
    tempDirs.push(dir);
    return path.join(dir, 'schema.sqlite3');
}

function expectExitZero(result, label) {
    if (!result || result.code !== 0) {
        throw new Error(describeResult(label, result));
    }
}

async function bootstrapped(dbFile) {
    const { prepare, migrate } = await runBootstrap(dbFile);
    expectExitZero(prepare, 'db-prepare');
    expectExitZero(migrate, 'db:migrate');
    return snapshotSqlite(dbFile);
}

function upgradeDatabaseUrl(baseUrl) {
    const url = new URL(baseUrl);
    const name = url.pathname.replace(/^\//, '') || 'tududi_test';
    url.pathname = `/${name}_upgrade`;
    return { url: url.toString(), name: `${name}_upgrade` };
}

async function withPostgresAdmin(baseUrl, fn) {
    const { Client } = require('pg');
    const {
        resolveDatabaseSettings,
    } = require('../../config/database-settings');
    const settings = resolveDatabaseSettings({ DATABASE_URL: baseUrl }, null);
    const admin = new Client({
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
        ssl: settings.ssl
            ? { rejectUnauthorized: settings.ssl.rejectUnauthorized }
            : undefined,
    });
    await admin.connect();
    try {
        return await fn(admin);
    } finally {
        await admin.end();
    }
}

let reference;
let postgresPrepareOutput = '';

beforeAll(async () => {
    const modelsFile = emptyTempFile();
    expectExitZero(await runSync(modelsFile), 'db-sync');
    reference = await snapshotSqlite(modelsFile);

    targets.push({
        name: 'fresh',
        snapshot: await bootstrapped(emptyTempFile()),
    });

    for (const fixture of listFixtures()) {
        const temp = copyToTemp(fixture.file);
        tempDirs.push(temp.dir);
        targets.push({
            name: `legacy-${fixture.name}`,
            snapshot: await bootstrapped(temp.file),
        });
    }

    if (POSTGRES_URL) {
        const { url, name } = upgradeDatabaseUrl(POSTGRES_URL);
        await withPostgresAdmin(POSTGRES_URL, async (admin) => {
            await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
            await admin.query(`CREATE DATABASE "${name}"`);
        });
        const env = {
            ...process.env,
            NODE_ENV: 'production',
            DATABASE_URL: url,
            DB_DIALECT: '',
            DB_NAME: '',
            SEQUELIZE_LOGGING: 'false',
        };
        const { run } = require('./helpers/bootstrap');
        const prepare = await run('node', ['scripts/db-prepare.js'], env);
        expectExitZero(prepare, 'db-prepare (postgres)');
        postgresPrepareOutput = prepare.stdout;
        const migrate = await run(
            path.join(
                __dirname,
                '..',
                '..',
                '..',
                'node_modules',
                '.bin',
                'sequelize'
            ),
            ['db:migrate', '--config', 'config/database.js'],
            env
        );
        expectExitZero(migrate, 'db:migrate (postgres)');
        targets.push({
            name: 'postgres',
            snapshot: await snapshotPostgres(url),
        });
    }
});

afterAll(async () => {
    for (const dir of tempDirs) removeTemp(dir);
    if (POSTGRES_URL) {
        const { name } = upgradeDatabaseUrl(POSTGRES_URL);
        await withPostgresAdmin(POSTGRES_URL, (admin) =>
            admin.query(`DROP DATABASE IF EXISTS "${name}"`)
        );
    }
});

describe('schema parity with the models', () => {
    it('captured a reference snapshot from the models', () => {
        expect(Object.keys(reference.tables).length).toBeGreaterThan(20);
        expect(reference.tables.users).toBeDefined();
        expect(reference.tables.tasks).toBeDefined();
    });

    it('bootstraps PostgreSQL from the models with a baseline', () => {
        // Only meaningful with DATABASE_URL set; otherwise the target is absent.
        const expected = POSTGRES_URL ? 'recorded as baseline' : '';
        expect(postgresPrepareOutput).toContain(expected);
    });

    it('compares every target', () => {
        const names = targets.map((target) => target.name);
        expect(names).toContain('fresh');
        expect(names.some((name) => name.startsWith('legacy-'))).toBe(true);
        expect(names.includes('postgres')).toBe(Boolean(POSTGRES_URL));

        const report = [];
        const failures = [];
        for (const target of targets) {
            const { hard, soft } = diffSnapshots(reference, target.snapshot);
            const { allowed, remaining } = applyAllowlist(
                hard,
                allowlist,
                target.name
            );
            report.push(
                `== ${target.name}: ${remaining.length} blocking, ${allowed.length} allow-listed, ${soft.length} informational`
            );
            if (remaining.length) {
                report.push('blocking:\n' + formatFindings(remaining));
            }
            if (allowed.length) {
                report.push('allow-listed:\n' + formatFindings(allowed));
            }
            if (soft.length) {
                report.push('informational:\n' + formatFindings(soft));
            }
            if (remaining.length) {
                failures.push({ target: target.name, findings: remaining });
            }
        }

        if (REPORT_ONLY || failures.length) {
            // eslint-disable-next-line no-console
            console.log(report.join('\n'));
        }
        // In report mode the run never fails; the output above is the result.
        expect(REPORT_ONLY ? [] : failures).toEqual([]);
    });

    it('does not carry stale allowlist entries', () => {
        const used = new Set();
        for (const target of targets) {
            const { hard } = diffSnapshots(reference, target.snapshot);
            for (const finding of hard) {
                if (allowlist[finding.key]) used.add(finding.key);
            }
        }
        const stale = Object.keys(allowlist).filter((key) => !used.has(key));
        expect(stale).toEqual([]);
    });
});
