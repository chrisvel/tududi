#!/usr/bin/env node

// Copies a SQLite database to a new file with VACUUM INTO.
//
//   node scripts/sqlite-backup.js <source.sqlite3> <backup.sqlite3>
//
// A plain file copy misses every write still sitting in the -wal file,
// which is left behind whenever the app stops without closing the database.
// Opening the database replays that WAL, and VACUUM INTO writes one
// consistent, self-contained file.

const fs = require('fs');
const sqlite3 = require('sqlite3');

const [source, target] = process.argv.slice(2);
if (!source || !target) {
    console.error('Usage: sqlite-backup.js <source> <target>');
    process.exit(2);
}
if (fs.existsSync(target)) {
    console.error(`Backup target already exists: ${target}`);
    process.exit(1);
}

const fail = (error) => {
    console.error(`SQLite backup failed: ${error.message}`);
    fs.rmSync(target, { force: true });
    process.exit(1);
};

const db = new sqlite3.Database(source, sqlite3.OPEN_READWRITE, (openError) => {
    if (openError) return fail(openError);
    db.run('VACUUM INTO ?', [target], (vacuumError) => {
        db.close((closeError) => {
            if (vacuumError || closeError)
                return fail(vacuumError || closeError);
        });
    });
});
