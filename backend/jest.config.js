module.exports = {
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
    setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.spec.js'],
    testPathIgnorePatterns: ['/node_modules/'],
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
        // marked ships only an ES module, which Node 22 can require but Jest
        // cannot; its UMD build is the same code.
        '^marked$': require
            .resolve('marked')
            .replace(/marked\.esm\.js$/, 'marked.umd.js'),
    },
};
