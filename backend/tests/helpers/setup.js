// Set test environment before importing models
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const config = require('../../config/config');

beforeAll(async () => {
    // Ensure test database is clean and created
    await mongoose.connect(config.mongodb_uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    await mongoose.connection.dropDatabase();
}, 30000);

afterAll(async () => {
    try {
        await mongoose.disconnect();
    } catch (error) {
        // Database may already be closed
    }
}, 30000);
