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

    host: process.env.HOST || '0.0.0.0',

    port: process.env.PORT || 3002,

    password: process.env.TUDUDI_USER_PASSWORD,

    production,

    secret:
        process.env.TUDUDI_SESSION_SECRET ||
        require('crypto').randomBytes(64).toString('hex'),

    credentials,

    sslEnabled:
        production && process.env.TUDUDI_INTERNAL_SSL_ENABLED === 'true',
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
