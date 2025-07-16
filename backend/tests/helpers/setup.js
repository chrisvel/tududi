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
        const models = Object.values(sequelize.models);
        const nonSessionModels = models.filter(
            (model) => model.name !== 'Session'
        );
        await Promise.all(
            nonSessionModels.map((model) =>
                model.destroy({ truncate: true, cascade: true })
            )
        );
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
