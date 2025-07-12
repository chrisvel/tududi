// Set test environment before importing models
process.env.NODE_ENV = 'test';

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
