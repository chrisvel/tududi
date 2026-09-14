const fs = require('fs');
const { getConfig } = require('../../config/config');

// A DATABASE_URL or DB_DIALECT left in the environment silently moves an
// existing SQLite deployment onto an empty PostgreSQL schema: the app comes up
// with no data while the SQLite file sits untouched. Refuse to continue when
// the SQLite file that this deployment would otherwise use holds data, unless
// the operator confirms the switch.
//
// This has to run before anything else even tries to reach PostgreSQL (the
// schema lock included) so the banner below is guaranteed to be the first
// thing an operator sees, rather than a bare connection-refused error.
function guardAgainstAccidentalDialectSwitch(dialect) {
    if (dialect !== 'postgres') return;
    if (process.env.TUDUDI_ALLOW_DIALECT_SWITCH === 'true') return;

    const sqliteFile = getConfig().dbFile;
    if (!sqliteFile) return;

    let size = 0;
    try {
        size = fs.statSync(sqliteFile).size;
    } catch (_) {
        return;
    }
    if (size === 0) return;

    console.error('');
    console.error(
        '❌ PostgreSQL is selected (DATABASE_URL or DB_DIALECT is set), but an existing SQLite database was found:'
    );
    console.error(`   ${sqliteFile} (${size} bytes)`);
    console.error('');
    console.error(
        '   There is no automatic transfer between engines. Starting now would bring up an empty PostgreSQL'
    );
    console.error('   database and your SQLite data would not be visible.');
    console.error('');
    console.error(
        '   To keep using SQLite: unset DATABASE_URL and DB_DIALECT.'
    );
    console.error(
        '   To start on PostgreSQL anyway (fresh data, or data already imported): set TUDUDI_ALLOW_DIALECT_SWITCH=true.'
    );
    console.error('');
    process.exit(1);
}

module.exports = { guardAgainstAccidentalDialectSwitch };
