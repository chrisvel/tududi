// Runs once per test file (Jest resets the module registry between files),
// so pointing the models at a database here gives every file its own
// isolated database.
//
// SQLite (default): a throwaway file per test file under /tmp.
// PostgreSQL (DATABASE_URL or DB_DIALECT=postgres set): one database per
// Jest worker, created by globalSetup.js, with tables recreated per file.

const { testDatabaseName } = require('./test-db');

// CalDAV routes 404 unless the flag is on; the CalDAV suites expect it on
// unless a test turns it off deliberately.
if (process.env.FF_ENABLE_CALDAV === undefined) {
    process.env.FF_ENABLE_CALDAV = 'true';
}

if (process.env.DATABASE_URL || process.env.DB_DIALECT) {
    const workerDb = testDatabaseName(process.env.JEST_WORKER_ID || '1');
    if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        url.pathname = `/${workerDb}`;
        process.env.DATABASE_URL = url.toString();
    } else {
        process.env.DB_NAME = workerDb;
    }
} else {
    const testId = require('crypto').randomBytes(4).toString('hex');
    process.env.DB_FILE = `/tmp/test-${testId}.sqlite3`;
}

const { sequelize } = require('../../models');
const { isSqlite, truncateTables } = require('../../utils/db-dialect');

// Children before parents: PostgreSQL deletes these with constraints on.
const CLEANUP_TABLES = [
    'tasks_tags',
    'notes_tags',
    'projects_tags',
    'task_events',
    'task_attachments',
    'recurring_completions',
    'caldav_occurrence_overrides',
    'caldav_sync_state',
    'caldav_remote_calendars',
    'caldav_calendars',
    'calendar_tokens',
    'rate_limits',
    'notifications',
    'permissions',
    // actions and the audit/identity tables reference users; on PostgreSQL
    // the FK blocks DELETE FROM users when they are left out, and the
    // cleanup loop stops at the first failure.
    'actions',
    'auth_audit_log',
    'oidc_identities',
    'views',
    'api_tokens',
    'backups',
    'inbox_items',
    'tasks',
    'notes',
    'tags',
    'user_project_areas',
    'projects',
    'goals',
    'areas',
    'people',
    'roles',
    'users',
];

beforeAll(async () => {
    // Ensure test database is clean and created with proper schema
    await sequelize.sync({ force: true });

    if (isSqlite()) {
        // Disable foreign key constraints for tests to avoid issues with test data creation
        await sequelize.query('PRAGMA foreign_keys = OFF');
    }
}, 60000);

beforeEach(async () => {
    // Clean all tables except Sessions to avoid conflicts
    try {
        await truncateTables(sequelize, CLEANUP_TABLES);
    } catch (error) {
        // Ignore errors during cleanup
    }
});

afterEach(async () => {
    // Clean up sessions after each test
    try {
        const Session = sequelize.models.Session;
        if (Session) {
            await Session.destroy({ where: {} });
        }
    } catch (error) {
        // Ignore errors during session cleanup
    }
});

afterAll(async () => {
    try {
        await sequelize.close();
    } catch (error) {
        // Database may already be closed
    }
}, 30000);
