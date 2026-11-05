const fs = require('fs');

// tududi 1.x kept its data in a SQLite file. 2.0 runs on PostgreSQL only and
// has no automatic transfer, so starting 2.0 on a volume that still holds a
// populated SQLite file would bring up an empty instance while the old data
// sits next to it unseen. Refuse to start until the data has been moved,
// unless the operator confirms it already was.
//
// Side-effect free apart from the exit, and independent of the database
// settings, so it can run before a missing DATABASE_URL is reported.

const MOVE_GUIDE =
    'https://github.com/chrisvel/tududi/blob/main/docs/30-moving-to-postgres.md';

function findPopulatedFile(files) {
    for (const file of files) {
        try {
            const { size } = fs.statSync(file);
            if (size > 0) return { file, size };
        } catch (_) {}
    }
    return null;
}

function guardAgainstLeftoverSqlite(files) {
    if (process.env.TUDUDI_ALLOW_DIALECT_SWITCH === 'true') return;

    const found = findPopulatedFile(files);
    if (!found) return;

    console.error('');
    console.error(
        '❌ A tududi 1.x SQLite database was found, but tududi 2.0 runs on PostgreSQL only:'
    );
    console.error(`   ${found.file} (${found.size} bytes)`);
    console.error('');
    console.error(
        '   Your data is not moved automatically. Go back to the final 1.x release, take an'
    );
    console.error(
        '   instance export in Settings > Backups, then import it into 2.0. Steps:'
    );
    console.error(`   ${MOVE_GUIDE}`);
    console.error('');
    console.error(
        '   Once the data is imported (or to start fresh), set TUDUDI_ALLOW_DIALECT_SWITCH=true or remove the file.'
    );
    console.error('');
    process.exit(1);
}

module.exports = { guardAgainstLeftoverSqlite, MOVE_GUIDE };
