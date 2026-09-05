// Jest config for the upgrade suite (tests/upgrade). These tests run the real
// bootstrap (db-prepare + sequelize-cli migrations) against legacy SQLite
// fixtures, so they must not use the sync-based tests/helpers/setup.js.
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/upgrade/**/*.test.js'],
    testTimeout: 180000,
    maxWorkers: 1,
    forceExit: true,
    clearMocks: true,
    verbose: true,
    moduleNameMapper: {
        '^jose$': '<rootDir>/tests/mocks/jose.js',
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js',
    },
};
