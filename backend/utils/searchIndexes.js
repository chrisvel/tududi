'use strict';

// Search runs LOWER(column) LIKE '%term%'. On PostgreSQL a trigram GIN
// index over the same expression turns that from a sequential scan into an
// index lookup. SQLite has no equivalent, so this is a no-op there.
//
// Called from the migration (existing databases) and from db-prepare
// (fresh PostgreSQL databases, whose schema comes from sync() and never
// replays the migrations).

const SEARCH_INDEXES = [
    ['tasks', 'name', 'tasks_name_trgm'],
    ['tasks', 'note', 'tasks_note_trgm'],
    ['notes', 'title', 'notes_title_trgm'],
    ['notes', 'content', 'notes_content_trgm'],
    ['projects', 'name', 'projects_name_trgm'],
    ['projects', 'description', 'projects_description_trgm'],
];

async function tableExists(sequelize, table) {
    const [rows] = await sequelize.query(
        'SELECT 1 FROM information_schema.tables WHERE table_name = :table',
        { replacements: { table } }
    );
    return rows.length > 0;
}

async function ensureSearchIndexes(sequelize) {
    if (sequelize.getDialect() !== 'postgres') return [];

    const created = [];
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    for (const [table, column, name] of SEARCH_INDEXES) {
        if (!(await tableExists(sequelize, table))) continue;
        await sequelize.query(
            `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" USING gin (LOWER("${column}") gin_trgm_ops)`
        );
        created.push(name);
    }

    // connect-session-sequelize sweeps expired rows every 15 minutes with a
    // WHERE on expires; without an index that is a table scan.
    if (await tableExists(sequelize, 'Sessions')) {
        await sequelize.query(
            'CREATE INDEX IF NOT EXISTS "sessions_expires" ON "Sessions" ("expires")'
        );
        created.push('sessions_expires');
    }

    return created;
}

async function dropSearchIndexes(sequelize) {
    if (sequelize.getDialect() !== 'postgres') return;
    for (const [, , name] of SEARCH_INDEXES) {
        await sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
    }
    await sequelize.query('DROP INDEX IF EXISTS "sessions_expires"');
}

module.exports = { ensureSearchIndexes, dropSearchIndexes, SEARCH_INDEXES };
