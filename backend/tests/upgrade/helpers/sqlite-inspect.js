const sqlite3 = require('sqlite3');

// Thin promise wrapper over the sqlite3 driver so the tests can inspect a
// database file without loading the application's Sequelize instance.
function open(file) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (err) =>
            err ? reject(err) : resolve(db)
        );
    });
}

function all(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
    });
}

async function withDb(file, fn) {
    const db = await open(file);
    try {
        return await fn(db);
    } finally {
        await close(db);
    }
}

async function tableNames(file) {
    return withDb(file, async (db) => {
        const rows = await all(
            db,
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return rows.map((row) => row.name);
    });
}

async function rowCounts(file) {
    return withDb(file, async (db) => {
        const tables = await all(
            db,
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        const counts = {};
        for (const { name } of tables) {
            const [row] = await all(db, `SELECT COUNT(*) AS n FROM "${name}"`);
            counts[name] = Number(row.n);
        }
        return counts;
    });
}

async function integrityCheck(file) {
    return withDb(file, async (db) => {
        const rows = await all(db, 'PRAGMA integrity_check');
        return rows.map((row) => row.integrity_check).join('\n');
    });
}

async function foreignKeyCheck(file) {
    return withDb(file, (db) => all(db, 'PRAGMA foreign_key_check'));
}

async function metaNames(file) {
    return withDb(file, async (db) => {
        const rows = await all(
            db,
            'SELECT name FROM "SequelizeMeta" ORDER BY name'
        );
        return rows.map((row) => row.name);
    });
}

async function query(file, sql) {
    return withDb(file, (db) => all(db, sql));
}

async function snapshot(file) {
    return {
        tables: await tableNames(file),
        counts: await rowCounts(file),
        meta: await metaNames(file),
        fkViolations: (await foreignKeyCheck(file)).length,
    };
}

module.exports = {
    tableNames,
    rowCounts,
    integrityCheck,
    foreignKeyCheck,
    metaNames,
    query,
    snapshot,
};
