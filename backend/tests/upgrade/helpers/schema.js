const path = require('path');
const { run, sqliteEnv } = require('./bootstrap');

const SNAPSHOT_SCRIPT = path.join('scripts', 'schema-snapshot.js');

function parseLastLine(result, label) {
    if (result.code !== 0) {
        throw new Error(
            `${label}: exit ${result.code}\n${result.stdout}\n${result.stderr}`
        );
    }
    const lines = result.stdout.trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
}

async function snapshotSqlite(dbFile) {
    const result = await run('node', [SNAPSHOT_SCRIPT], sqliteEnv(dbFile));
    return parseLastLine(result, `schema-snapshot ${dbFile}`);
}

async function snapshotPostgres(databaseUrl) {
    const env = {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        DB_DIALECT: '',
        DB_NAME: '',
        SEQUELIZE_LOGGING: 'false',
    };
    const result = await run('node', [SNAPSHOT_SCRIPT], env);
    return parseLastLine(result, `schema-snapshot ${databaseUrl}`);
}

function uniqueSets(table) {
    return (table.indexes || [])
        .filter((index) => index.unique)
        .map((index) => index.fields.join(','));
}

// Compares a reference snapshot (normally the one produced by
// sequelize.sync() from the models) with a target. "hard" findings are the
// ones that break the application or lose integrity constraints; "soft" ones
// are recorded for review but never fail on their own.
function diffSnapshots(reference, target) {
    const hard = [];
    const soft = [];
    const ref = reference.tables;
    const tgt = target.tables;

    for (const table of Object.keys(ref)) {
        if (!tgt[table]) {
            hard.push({ key: `${table}:table`, message: 'table missing' });
            continue;
        }
        for (const column of Object.keys(ref[table].columns)) {
            const a = ref[table].columns[column];
            const b = tgt[table].columns[column];
            const prefix = `${table}.${column}`;
            if (!b) {
                hard.push({
                    key: `${prefix}:column`,
                    message: 'column missing',
                });
                continue;
            }
            if (a.type !== b.type) {
                // SQLite has no ENUM type; Sequelize stores it as TEXT with a
                // CHECK constraint, so string/enum pairs are expected.
                const enumAsText =
                    [a.type, b.type].includes('enum') &&
                    [a.type, b.type].includes('string');
                (enumAsText ? soft : hard).push({
                    key: `${prefix}:type`,
                    message: `type ${a.type} vs ${b.type}`,
                });
            }
            // SQLite describes INTEGER PRIMARY KEY columns as nullable, so
            // nullability is only comparable for non-key columns.
            if (!a.primaryKey && !b.primaryKey && a.allowNull !== b.allowNull) {
                hard.push({
                    key: `${prefix}:allowNull`,
                    message: `allowNull ${a.allowNull} vs ${b.allowNull}`,
                });
            }
            if (a.length !== b.length) {
                soft.push({
                    key: `${prefix}:length`,
                    message: `length ${a.length} vs ${b.length}`,
                });
            }
            if (a.hasDefault !== b.hasDefault) {
                soft.push({
                    key: `${prefix}:hasDefault`,
                    message: `hasDefault ${a.hasDefault} vs ${b.hasDefault}`,
                });
            }
            if (
                a.enumValues &&
                b.enumValues &&
                JSON.stringify(a.enumValues) !== JSON.stringify(b.enumValues)
            ) {
                hard.push({
                    key: `${prefix}:enum`,
                    message: `enum ${a.enumValues} vs ${b.enumValues}`,
                });
            }
        }
        const refUnique = uniqueSets(ref[table]);
        const tgtUnique = uniqueSets(tgt[table]);
        for (const fields of refUnique) {
            if (!tgtUnique.includes(fields)) {
                hard.push({
                    key: `${table}:unique(${fields})`,
                    message: 'unique index missing',
                });
            }
        }
    }

    for (const table of Object.keys(tgt)) {
        if (!ref[table]) {
            soft.push({ key: `${table}:table`, message: 'extra table' });
            continue;
        }
        for (const column of Object.keys(tgt[table].columns)) {
            if (!ref[table].columns[column]) {
                soft.push({
                    key: `${table}.${column}:column`,
                    message: 'extra column',
                });
            }
        }
    }

    return { hard, soft };
}

function applyAllowlist(findings, allowlist, targetName) {
    const allowed = [];
    const remaining = [];
    for (const finding of findings) {
        const entry = allowlist[finding.key];
        const matches =
            entry &&
            (!entry.targets ||
                entry.targets.some((pattern) =>
                    new RegExp(pattern).test(targetName)
                ));
        (matches ? allowed : remaining).push(finding);
    }
    return { allowed, remaining };
}

function formatFindings(findings) {
    return findings.map((f) => `  ${f.key}: ${f.message}`).join('\n');
}

module.exports = {
    snapshotSqlite,
    snapshotPostgres,
    diffSnapshots,
    applyAllowlist,
    formatFindings,
};
