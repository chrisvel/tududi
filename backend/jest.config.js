module.exports = {
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
    setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.spec.js'],
    // The upgrade suite has its own config (jest.upgrade.config.js) because it
    // must not use the sync-based setup.js.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/upgrade/'],
    collectCoverageFrom: [
        'routes/**/*.js',
        'models/**/*.js',
        'middleware/**/*.js',
        'services/**/*.js',
        '!models/index.js',
        '!**/*.test.js',
        '!**/*.spec.js',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: false,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
    maxWorkers: '100%',
    moduleNameMapper: {
        '^jose$': '<rootDir>/tests/mocks/jose.js',
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js',
    },
};
