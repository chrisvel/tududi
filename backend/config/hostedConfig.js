const { getConfig } = require('./config');

const isLocal = (url) =>
    !url || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(url);

// Returns the list of things that would make a public, multi-user instance
// unsafe or unusable. Empty when hosted mode is off or everything is set.
function hostedConfigProblems(env = process.env, config = getConfig()) {
    if (!config.hosted?.enabled) return [];

    const problems = [];

    if (!env.TUDUDI_SESSION_SECRET) {
        problems.push(
            'TUDUDI_SESSION_SECRET is not set: every restart would sign everyone out and a second process could not share sessions'
        );
    }
    if (!config.trustProxy) {
        problems.push(
            'TUDUDI_TRUST_PROXY is off: behind a reverse proxy the session cookie loses its Secure flag and every user shares one rate-limit bucket'
        );
    }
    if (!env.TUDUDI_ALLOWED_ORIGINS) {
        problems.push(
            'TUDUDI_ALLOWED_ORIGINS is not set: CORS would only allow localhost'
        );
    }
    if (isLocal(env.FRONTEND_URL)) {
        problems.push(
            'FRONTEND_URL is unset or points at localhost: emailed links (verification, password reset) would be unusable'
        );
    }
    if (isLocal(env.BACKEND_URL || env.BASE_URL)) {
        problems.push(
            'BACKEND_URL (or BASE_URL) is unset or points at localhost: verification links would be unusable'
        );
    }
    if (!config.emailConfig?.enabled || !config.emailConfig?.smtp?.host) {
        problems.push(
            'ENABLE_EMAIL=true with EMAIL_SMTP_HOST is required: registration and password reset depend on email'
        );
    }
    if (config.db?.dialect !== 'postgres') {
        problems.push(
            'DATABASE_URL must point at PostgreSQL: SQLite cannot serve several processes or many concurrent users'
        );
    }

    return problems;
}

function assertHostedConfig(env = process.env, config = getConfig()) {
    const problems = hostedConfigProblems(env, config);
    if (problems.length === 0) return;

    console.error(
        'TUDUDI_HOSTED_MODE=true but the instance is not configured for it:'
    );
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    console.error('Fix the settings above or unset TUDUDI_HOSTED_MODE.');
    process.exit(1);
}

module.exports = { hostedConfigProblems, assertHostedConfig };
