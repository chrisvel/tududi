// Resolves how to reach the PostgreSQL database, from env vars.
// Side-effect free so it can run outside the app (Jest globalSetup, scripts).
//
// Set either DATABASE_URL=postgres://... or DB_HOST plus DB_NAME etc.

const { parse } = require('pg-connection-string');

function parseDatabaseUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch (err) {
        throw new Error(`DATABASE_URL is not a valid URL: ${err.message}`);
    }

    const protocol = parsed.protocol.replace(':', '');
    if (protocol !== 'postgres' && protocol !== 'postgresql') {
        throw new Error(
            `DATABASE_URL must use the postgres:// scheme (got '${protocol}://')`
        );
    }

    const sslMode = parsed.searchParams.get('sslmode');
    const sslFromUrl =
        parsed.searchParams.get('ssl') === 'true' ||
        (sslMode !== null && sslMode !== 'disable');

    return {
        host: parsed.hostname || 'localhost',
        port: parsed.port ? parseInt(parsed.port, 10) : 5432,
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
        username: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        sslFromUrl,
    };
}

function resolveDatabaseSettings(env) {
    const rawDialect = (env.DB_DIALECT || '').trim().toLowerCase();
    if (
        rawDialect &&
        rawDialect !== 'postgres' &&
        rawDialect !== 'postgresql'
    ) {
        throw new Error(
            `DB_DIALECT '${env.DB_DIALECT}' is no longer supported: tududi 2.0 runs on PostgreSQL only. ` +
                'Remove DB_DIALECT and set DATABASE_URL. Moving from SQLite: docs/30-moving-to-postgres.md'
        );
    }

    if (!env.DATABASE_URL && !env.DB_HOST) {
        throw new Error(
            'No database configured. tududi needs PostgreSQL: set DATABASE_URL=postgres://user:password@host:5432/tududi ' +
                '(or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD).'
        );
    }

    const fromUrl = env.DATABASE_URL
        ? parseDatabaseUrl(env.DATABASE_URL)
        : null;

    const sslEnv = (env.DB_SSL || '').trim().toLowerCase();
    const sslEnabled =
        sslEnv === 'true' ||
        sslEnv === '1' ||
        (sslEnv === '' && fromUrl !== null && fromUrl.sslFromUrl);

    // Certificates are verified unless explicitly opted out (self-signed
    // certificates on a private network, for example).
    const rejectUnauthorized =
        (env.DB_SSL_REJECT_UNAUTHORIZED || '').trim().toLowerCase() !== 'false';

    // Keep sslrootcert/sslcert/sslkey from the URL
    const urlSsl = env.DATABASE_URL ? parse(env.DATABASE_URL).ssl : null;

    const poolMax = env.DB_POOL_MAX ? parseInt(env.DB_POOL_MAX, 10) : 10;

    return {
        dialect: 'postgres',
        host: env.DB_HOST || (fromUrl && fromUrl.host) || 'localhost',
        port: env.DB_PORT
            ? parseInt(env.DB_PORT, 10)
            : (fromUrl && fromUrl.port) || 5432,
        database: env.DB_NAME || (fromUrl && fromUrl.database) || 'tududi',
        username: env.DB_USER || (fromUrl && fromUrl.username) || 'tududi',
        password: env.DB_PASSWORD || (fromUrl && fromUrl.password) || '',
        ssl: sslEnabled ? { ...urlSsl, rejectUnauthorized } : false,
        poolMax: Number.isInteger(poolMax) && poolMax > 0 ? poolMax : 10,
    };
}

module.exports = {
    parseDatabaseUrl,
    resolveDatabaseSettings,
};
