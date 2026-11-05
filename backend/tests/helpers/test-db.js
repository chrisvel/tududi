// Shared naming for per-worker PostgreSQL test databases. Kept dependency-free
// because globalSetup.js runs in Jest's parent process before any module mocks.

// Matches the db service in docker-compose.dev.yml.
const DEFAULT_TEST_DATABASE_URL =
    'postgres://tududi:tududi@localhost:5432/tududi_test';

// Points the suite at the default database when nothing else is configured.
function applyDefaultTestDatabase(env = process.env) {
    if (!env.DATABASE_URL && !env.DB_HOST) {
        env.DATABASE_URL = DEFAULT_TEST_DATABASE_URL;
    }
}

function baseTestDatabaseName(env = process.env) {
    if (env.DATABASE_URL) {
        const url = new URL(env.DATABASE_URL);
        return url.pathname.replace(/^\//, '') || 'tududi_test';
    }
    return env.DB_NAME || 'tududi_test';
}

function testDatabaseName(workerId, env = process.env) {
    return `${baseTestDatabaseName(env)}_w${workerId}`;
}

module.exports = {
    DEFAULT_TEST_DATABASE_URL,
    applyDefaultTestDatabase,
    baseTestDatabaseName,
    testDatabaseName,
};
