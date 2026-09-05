// Runs the real production bootstrap (scripts/db-prepare.js followed by
// sequelize-cli db:migrate, exactly as cmd/start.sh does) against SQLite
// databases produced by older releases, then boots the app on the upgraded
// file in a fresh process and exercises the read and write paths that changed
// recently.
//
// Fixtures live in tests/fixtures/legacy (see README.md there). Extra
// databases can be added for a single run with LEGACY_FIXTURE_DIR=/dir.

const {
    listFixtures,
    copyToTemp,
    removeTemp,
    migrationFiles,
} = require('./helpers/fixtures');
const {
    runBootstrap,
    runSmoke,
    describeResult,
} = require('./helpers/bootstrap');
const inspect = require('./helpers/sqlite-inspect');

const SELF_PERSON_MIGRATION = '20260722000002-backfill-missing-self-persons.js';

const fixtures = listFixtures();

if (fixtures.length === 0) {
    throw new Error(
        'No legacy fixtures found. Run `npm run fixtures:legacy` first.'
    );
}

async function usersWithoutSelfPerson(file) {
    const [{ n: userCount }] = await inspect.query(
        file,
        'SELECT COUNT(*) AS n FROM users'
    );
    const columns = await inspect.query(file, 'PRAGMA table_info(people)');
    if (!columns.some((column) => column.name === 'linked_user_id')) {
        return Number(userCount);
    }
    const [{ n }] = await inspect.query(
        file,
        'SELECT COUNT(*) AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.user_id = u.id AND p.linked_user_id = u.id)'
    );
    return Number(n);
}

function expectExitZero(result, label) {
    if (!result || result.code !== 0) {
        throw new Error(describeResult(label, result));
    }
}

describe.each(fixtures)('upgrade from $name', (fixture) => {
    // External databases (LEGACY_FIXTURE_DIR) have unknown accounts, so the
    // login-based smoke checks only apply to the committed fixtures.
    const describeSeeded = fixture.manifest ? describe : describe.skip;
    let temp;
    let before;
    let pending;
    let selfPersonsToAdd;
    let firstRun;
    let smoke;

    beforeAll(async () => {
        temp = copyToTemp(fixture.file);
        before = await inspect.snapshot(temp.file);
        pending = migrationFiles().filter(
            (name) => !before.meta.includes(name)
        );
        selfPersonsToAdd = pending.includes(SELF_PERSON_MIGRATION)
            ? await usersWithoutSelfPerson(temp.file)
            : 0;
        firstRun = await runBootstrap(temp.file);
    });

    afterAll(() => {
        removeTemp(temp && temp.dir);
    });

    it('starts from a consistent fixture', async () => {
        expect(await inspect.integrityCheck(fixture.file)).toBe('ok');
        expect(before.tables).toContain('users');
        expect(before.counts.users).toBeGreaterThanOrEqual(1);
        // Committed fixtures must match their manifest; external ones have none.
        const expectedCounts = fixture.manifest
            ? fixture.manifest.row_counts
            : before.counts;
        expect(before.counts).toEqual(expectedCounts);
    });

    it('db-prepare leaves an existing database alone', () => {
        expectExitZero(firstRun.prepare, 'db-prepare');
        expect(firstRun.prepare.stdout).toContain('Existing database detected');
        expect(firstRun.prepare.stdout).not.toContain(
            'Empty database detected'
        );
    });

    it('applies exactly the pending migrations', () => {
        expectExitZero(firstRun.migrate, 'db:migrate');
        // sequelize-cli logs "== <name without .js>: migrated" per migration,
        // or a single line when nothing was pending.
        const expectedLines = pending.length
            ? pending.map((name) => `== ${name.replace(/\.js$/, '')}: migrated`)
            : ['No migrations were executed'];
        for (const line of expectedLines) {
            expect(firstRun.migrate.stdout).toContain(line);
        }
    });

    it('records every migration file in SequelizeMeta', async () => {
        expect(await inspect.metaNames(temp.file)).toEqual(migrationFiles());
    });

    it('keeps the file consistent', async () => {
        expect(await inspect.integrityCheck(temp.file)).toBe('ok');
        const violations = await inspect.foreignKeyCheck(temp.file);
        expect(violations.length).toBeLessThanOrEqual(before.fkViolations);
    });

    it('preserves every row', async () => {
        const after = await inspect.rowCounts(temp.file);
        const expected = { ...before.counts };
        expected.SequelizeMeta = before.counts.SequelizeMeta + pending.length;
        if (selfPersonsToAdd > 0) {
            expected.people = (before.counts.people || 0) + selfPersonsToAdd;
        }
        for (const table of Object.keys(expected)) {
            expect({ table, count: after[table] }).toEqual({
                table,
                count: expected[table],
            });
        }
    });

    it('is idempotent on a second boot', async () => {
        const afterFirst = await inspect.snapshot(temp.file);
        const second = await runBootstrap(temp.file);
        expectExitZero(second.prepare, 'db-prepare (second run)');
        expectExitZero(second.migrate, 'db:migrate (second run)');
        expect(second.prepare.stdout).toContain('Existing database detected');
        expect(second.migrate.stdout).toContain('No migrations were executed');
        expect(await inspect.snapshot(temp.file)).toEqual(afterFirst);
    });

    describe('application smoke on the upgraded database', () => {
        beforeAll(async () => {
            smoke = await runSmoke(temp.file);
        });

        it('adds no tables except those the current models define', async () => {
            const after = await inspect.tableNames(temp.file);
            for (const table of before.tables) {
                expect(after).toContain(table);
            }
            const added = after.filter(
                (table) => !before.tables.includes(table)
            );
            expect(added.filter((table) => /_backup$/.test(table))).toEqual([]);
            for (const table of added) {
                expect(smoke.modelTables).toContain(table);
            }
        });

        describeSeeded('with the seeded accounts', () => {
            it('logs in a user whose stored email is lowercase', () => {
                expect(smoke.login.bob).toBe(200);
            });

            // Accounts created before the lowercasing hook (Feb 2026) still carry
            // mixed-case emails, which the current login lookup cannot find. Fixed
            // by the follow-up data migration ("lowercase legacy emails"); flip to
            // a plain `it` once it lands.
            it.failing(
                'logs in a legacy user with a mixed-case stored email',
                () => {
                    expect([
                        smoke.login.aliceLower,
                        smoke.login.aliceMixed,
                    ]).toEqual([200, 200]);
                }
            );

            it('serves every list and metrics endpoint', () => {
                expect(smoke.login.aliceAfterNormalise).toBe(200);
                for (const read of smoke.reads) {
                    expect(read).toEqual({ path: read.path, status: 200 });
                }
                for (const entry of smoke.projectStatuses) {
                    expect(entry).toEqual({ status: entry.status, code: 200 });
                }
                expect(smoke.bogusProjectStatus).toBeGreaterThanOrEqual(400);
                expect(smoke.bogusProjectStatus).toBeLessThan(500);
                for (const entry of smoke.tagCountTypes) {
                    expect(entry).toEqual({ key: entry.key, type: 'number' });
                }
                expect(smoke.allTasksCount).toBeGreaterThan(0);
            });

            it('writes through the model hooks', () => {
                expect(smoke.write).toEqual({
                    create: 201,
                    patch: 200,
                    delete: 200,
                    profile: 200,
                    selfPersonName: 'Robert',
                });
            });
        });
    });
});
