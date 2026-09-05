// Resolves which database engine to use and how to reach it, from env vars.
// Side-effect free so it can run outside the app (Jest globalSetup, scripts).
//
// SQLite (a file path) stays the default; PostgreSQL is opted into either
// with DATABASE_URL=postgres://... or DB_DIALECT=postgres plus DB_HOST etc.

const SUPPORTED_DIALECTS = ['sqlite', 'postgres'];

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

function resolveDatabaseSettings(env, dbFile) {
    const rawDialect = (env.DB_DIALECT || '').trim().toLowerCase();
    const dialect = env.DATABASE_URL
        ? 'postgres'
        : rawDialect === 'postgresql'
          ? 'postgres'
          : rawDialect || 'sqlite';

    if (!SUPPORTED_DIALECTS.includes(dialect)) {
        throw new Error(
            `Unsupported DB_DIALECT '${env.DB_DIALECT}'. Use one of: ${SUPPORTED_DIALECTS.join(', ')}`
        );
    }

    if (dialect === 'sqlite') {
        return { dialect: 'sqlite', storage: dbFile };
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
        ssl: sslEnabled ? { rejectUnauthorized } : false,
        poolMax: Number.isInteger(poolMax) && poolMax > 0 ? poolMax : 10,
    };
}

module.exports = {
    SUPPORTED_DIALECTS,
    parseDatabaseUrl,
    resolveDatabaseSettings,
};
