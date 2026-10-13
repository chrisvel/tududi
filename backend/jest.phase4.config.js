'use strict';
const base = require('./jest.config');
const threshold = { statements: 90, branches: 90, functions: 90, lines: 90 };
module.exports = {
    ...base,
    testMatch: [
        '<rootDir>/tests/ltd/**/*.test.js',
        '<rootDir>/tests/integration/ltd-metrics-journal.test.js',
        // T-601: milestone writes are Journal entries with their own Undo.
        '<rootDir>/tests/integration/ltd-milestones.test.js',
        // T-1102: lesson writes and review checks undo through the Journal.
        '<rootDir>/tests/integration/ltd-lessons.test.js',
    ],
    collectCoverage: true,
    collectCoverageFrom: [
        'modules/ltd-progress/**/*.js',
        'modules/ltd-journal/**/*.js',
    ],
    coverageDirectory: 'coverage/ltd-phase4',
    coverageReporters: ['text', 'json-summary'],
    coverageThreshold: {
        './modules/ltd-progress/': threshold,
        './modules/ltd-journal/': threshold,
    },
};
