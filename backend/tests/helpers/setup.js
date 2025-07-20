// This file is run once per each Jest worker,
// so changing the DB in the beginning of this file
// works.

const testId = require('crypto').randomBytes(4).toString('hex');
process.env.DB_FILE = `/tmp/test-${testId}.sqlite3`;
const { sequelize } = require('../../models');

beforeAll(async () => {
    // Ensure test database is clean and created
    await sequelize.sync({ force: true });
}, 30000);

beforeEach(async () => {
    // Clean all tables except Sessions to avoid conflicts
    try {
        // Use raw SQL for faster cleanup
        const tableNames = [
            'users',
            'areas',
            'projects',
            'tasks',
            'tags',
            'notes',
            'inbox_items',
            'task_events',
            'tasks_tags',
            'notes_tags',
            'projects_tags',
        ];

        await sequelize.query('PRAGMA foreign_keys = OFF');
        for (const tableName of tableNames) {
            await sequelize.query(`DELETE FROM ${tableName}`);
        }
        await sequelize.query('PRAGMA foreign_keys = ON');
    } catch (error) {
        // Ignore errors during cleanup
    }
});

afterEach(async () => {
    // Clean up sessions after each test
    try {
        const Session = sequelize.models.Session;
        if (Session) {
            await Session.destroy({ truncate: true });
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
