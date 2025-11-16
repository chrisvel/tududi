const path = require('path');

if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
) {
    console.error(
        "NODE_ENV should be one of 'production', 'development' or 'test'."
    );
    process.exit(1);
}

const environment = process.env.NODE_ENV;
const production = process.env.NODE_ENV === 'production';
const projectRootPath = path.join(__dirname, '..'); // backend root path

const credentials = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri:
            process.env.GOOGLE_REDIRECT_URI ||
            'http://localhost:3002/api/calendar/oauth/callback',
    },
};

const defaultHost = environment === 'test' ? '127.0.0.1' : '0.0.0.0';

const config = {
    allowedOrigins: process.env.TUDUDI_ALLOWED_ORIGINS
        ? process.env.TUDUDI_ALLOWED_ORIGINS.split(',').map((origin) =>
              origin.trim()
          )
        : [
              'http://localhost:8080',
              'http://localhost:9292',
              'http://127.0.0.1:8080',
              'http://127.0.0.1:9292',
          ],

    dbFile:
        process.env.DB_FILE ||
        path.join(projectRootPath, 'db', `${environment}.sqlite3`),

    disableScheduler: process.env.DISABLE_SCHEDULER === 'true',

    disableTelegram: process.env.DISABLE_TELEGRAM === 'true',

    email: process.env.TUDUDI_USER_EMAIL,

    environment,

    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',

    // Some CI/sandbox environments disallow binding to 0.0.0.0, so force
    // loopback for tests unless HOST is explicitly provided.
    host: process.env.HOST || defaultHost,

    port: process.env.PORT || 3002,

    password: process.env.TUDUDI_USER_PASSWORD,

    production,

    secret:
        process.env.TUDUDI_SESSION_SECRET ||
        require('crypto').randomBytes(64).toString('hex'),

    credentials,

    uploadPath:
        process.env.TUDUDI_UPLOAD_PATH || path.join(projectRootPath, 'uploads'),

    // API Documentation (Swagger)
    swagger: {
        enabled: process.env.SWAGGER_ENABLED !== 'false',
    },

    // Rate limiting configuration
    rateLimiting: {
        // Disable rate limiting in test environment
        enabled:
            process.env.RATE_LIMITING_ENABLED !== 'false' &&
            environment !== 'test',

        // Authentication endpoints (login, register)
        auth: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 5, // 5 requests per window
        },

        // General API for unauthenticated requests
        api: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_API_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_API_MAX) || 100, // 100 requests per window
        },

        // Authenticated API requests
        authenticatedApi: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_AUTH_API_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_AUTH_API_MAX) || 1000, // 1000 requests per window
        },

        // Resource creation endpoints
        createResource: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_CREATE_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_CREATE_MAX) || 50, // 50 requests per window
        },

        // API key management endpoints
        apiKeyManagement: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_API_KEY_WINDOW_MS) ||
                60 * 60 * 1000, // 1 hour
            max: parseInt(process.env.RATE_LIMIT_API_KEY_MAX) || 10, // 10 requests per window
        },
    },
};

console.log(`Using database file '${config.dbFile}'`);

function setConfig({ dbFile } = {}) {
    if (dbFile != null) {
        config.dbFile = dbFile;
    }
}

function getConfig() {
    return config;
}

module.exports = { setConfig, getConfig };
