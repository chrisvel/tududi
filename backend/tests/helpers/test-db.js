// Shared naming for per-worker PostgreSQL test databases. Kept dependency-free
// because globalSetup.js runs in Jest's parent process before any module mocks.

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

module.exports = { baseTestDatabaseName, testDatabaseName };
