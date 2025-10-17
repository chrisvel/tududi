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

    emailConfig: {
        enabled: process.env.ENABLE_EMAIL === 'true',
        smtp: {
            host: process.env.EMAIL_SMTP_HOST,
            port: process.env.EMAIL_SMTP_PORT
                ? parseInt(process.env.EMAIL_SMTP_PORT, 10)
                : 587,
            secure: process.env.EMAIL_SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_SMTP_USERNAME,
                pass: process.env.EMAIL_SMTP_PASSWORD,
            },
        },
        from: {
            address: process.env.EMAIL_FROM_ADDRESS,
            name: process.env.EMAIL_FROM_NAME || 'Tududi',
        },
    },

    registrationConfig: {
        enabled: process.env.ENABLE_REGISTRATION === 'true',
        tokenExpiryHours: process.env.REGISTRATION_TOKEN_EXPIRY_HOURS
            ? parseInt(process.env.REGISTRATION_TOKEN_EXPIRY_HOURS, 10)
            : 24,
    },

    environment,

    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',

    backendUrl: process.env.BACKEND_URL || 'http://localhost:3002',

    host: process.env.HOST || '0.0.0.0',

    port: process.env.PORT || 3002,

    password: process.env.TUDUDI_USER_PASSWORD,

    production,

    secret:
        process.env.TUDUDI_SESSION_SECRET ||
        require('crypto').randomBytes(64).toString('hex'),

    credentials,

    uploadPath:
        process.env.TUDUDI_UPLOAD_PATH || path.join(projectRootPath, 'uploads'),
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
