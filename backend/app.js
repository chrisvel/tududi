require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('./models');
const {
    initializeTelegramPolling,
} = require('./modules/telegram/telegramInitializer');
const taskScheduler = require('./modules/tasks/taskScheduler');
const { initializeEmailService } = require('./services/emailService');
const { setConfig, getConfig } = require('./config/config');
const config = getConfig();
const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE_PATH = `/api/${API_VERSION}`;

const app = express();

if (config.trustProxy !== false) {
    app.set('trust proxy', config.trustProxy);
    console.log(`[Trust Proxy] Enabled with value:`, config.trustProxy);
} else {
    console.log(`[Trust Proxy] Disabled (value: false)`);
}

console.log(`[Trust Proxy] Express setting confirmed:`, app.get('trust proxy'));

// Session store
const sessionStore = new SequelizeStore({
    db: sequelize,
});

// Middlewares
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                upgradeInsecureRequests:
                    process.env.DISABLE_HSTS === 'true' ? null : [],
            },
        },
        hsts:
            config.production && process.env.DISABLE_HSTS !== 'true'
                ? {
                      maxAge: 31536000,
                      includeSubDomains: true,
                      preload: true,
                  }
                : false,
    })
);
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(
    cors({
        origin: config.allowedOrigins,
        credentials: true,
        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'PROPFIND',
            'REPORT',
        ],
        allowedHeaders: [
            'Authorization',
            'Content-Type',
            'Accept',
            'X-Requested-With',
            'Depth',
            'If-Match',
            'If-None-Match',
        ],
        exposedHeaders: ['Content-Type', 'ETag', 'DAV', 'Allow'],
        maxAge: 1728000,
        preflightContinue: true,
    })
);

// Body parsing (skip for CalDAV routes which need raw body access)
app.use((req, res, next) => {
    const isCalDAVPath =
        req.path.startsWith('/caldav/') ||
        req.path.startsWith('/.well-known/caldav');

    if (isCalDAVPath) {
        return next();
    }

    express.json({ limit: `${config.fileUploadLimitMB}mb` })(req, res, next);
});

app.use((req, res, next) => {
    const isCalDAVPath =
        req.path.startsWith('/caldav/') ||
        req.path.startsWith('/.well-known/caldav');

    if (isCalDAVPath) {
        return next();
    }

    express.urlencoded({
        extended: true,
        limit: `${config.fileUploadLimitMB}mb`,
    })(req, res, next);
});

// Session configuration
const sessionMiddleware = session({
    secret: config.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: (() => {
            if (process.env.COOKIE_SECURE === 'false') {
                return false;
            }
            if (process.env.COOKIE_SECURE === 'true') {
                return true;
            }
            return 'auto';
        })(),
        maxAge: 2592000000, // 30 days
        sameSite: 'lax',
    },
});
app.use(sessionMiddleware);

// CalDAV routes (registered after session middleware to support session-based auth for API routes)
const caldavRoutes = require('./modules/caldav/routes');
app.use(caldavRoutes);

// CSRF protection using lusca (CodeQL recommended library)
const lusca = require('lusca');
const { csrfMiddleware } = require('./middleware/csrf');

// Pre-check middleware to exempt test/Bearer requests before lusca runs
app.use((req, res, next) => {
    // Public unauthenticated endpoints that should bypass CSRF
    // These are routes that don't require authentication and are used during login/registration
    const publicPaths = [
        '/api/login',
        '/api/register',
        '/api/verify-email',
        '/api/version',
        '/api/registration-status',
        '/api/health',
    ];

    const isPublicPath = publicPaths.some((path) => req.path === path);
    const isOidcPath = req.path.startsWith('/api/oidc/');
    const isFeatureFlagsPath = req.path.startsWith('/api/feature-flags');
    const isCalDAVPath =
        req.path.startsWith('/caldav/') ||
        req.path.startsWith('/.well-known/caldav');

    // Mark exempt requests so lusca wrapper can skip them
    if (
        process.env.NODE_ENV === 'test' ||
        req.headers.authorization?.startsWith('Bearer ') ||
        isPublicPath ||
        isOidcPath ||
        isFeatureFlagsPath ||
        isCalDAVPath
    ) {
        req._csrfExempt = true;
    }
    next();
});

// Apply lusca CSRF - wrapped to check exemption flag
// Only apply to state-changing methods (POST, PUT, PATCH, DELETE)
app.use((req, res, next) => {
    const statefulMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (req._csrfExempt || !statefulMethods.includes(req.method)) {
        return next();
    }
    return csrfMiddleware(req, res, next);
});

// Static files
if (config.production) {
    app.use(express.static(path.join(__dirname, 'dist')));
} else {
    app.use(express.static('public'));
}

// Serve locales
if (config.production) {
    app.use('/locales', express.static(path.join(__dirname, 'dist/locales')));
} else {
    app.use(
        '/locales',
        express.static(path.join(__dirname, '../public/locales'))
    );
}

// Serve uploaded files
const registerUploadsStatic = (basePath) => {
    app.use(`${basePath}/uploads`, express.static(config.uploadPath));
};

registerUploadsStatic('/api');
if (API_VERSION && API_BASE_PATH !== '/api') {
    registerUploadsStatic(API_BASE_PATH);
}

// Authentication middleware
const { requireAuth } = require('./middleware/auth');
const { logError } = require('./services/logService');

// Rate limiting middleware
const {
    apiLimiter,
    authenticatedApiLimiter,
} = require('./middleware/rateLimiter');

// Error handler for modular architecture
const errorHandler = require('./shared/middleware/errorHandler');

// Modular routes
const adminModule = require('./modules/admin');
const areasModule = require('./modules/areas');
const authModule = require('./modules/auth');
const backupModule = require('./modules/backup');
const featureFlagsModule = require('./modules/feature-flags');
const habitsModule = require('./modules/habits');
const inboxModule = require('./modules/inbox');
const notesModule = require('./modules/notes');
const notificationsModule = require('./modules/notifications');
const projectsModule = require('./modules/projects');
const quotesModule = require('./modules/quotes');
const searchModule = require('./modules/search');
const sharesModule = require('./modules/shares');
const tagsModule = require('./modules/tags');
const tasksModule = require('./modules/tasks');
const telegramModule = require('./modules/telegram');
const urlModule = require('./modules/url');
const usersModule = require('./modules/users');
const viewsModule = require('./modules/views');
const mcpModule = require('./modules/mcp');
const oidcModule = require('./modules/oidc');

// Swagger documentation - enabled by default, protected by authentication
// Mounted on /api-docs to avoid conflicts with API routes
if (config.swagger.enabled) {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./config/swagger');

    const swaggerUiOptions = {
        customSiteTitle: 'Tududi API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: {
            url: '/api-docs/swagger.json',
        },
    };
    // Expose on /api-docs, protected by authentication
    app.use('/api-docs', requireAuth, swaggerUi.serve);
    app.get('/api-docs/swagger.json', requireAuth, (req, res) =>
        res.json(swaggerSpec)
    );
    app.get(
        '/api-docs',
        requireAuth,
        swaggerUi.serveFiles(swaggerSpec, swaggerUiOptions),
        swaggerUi.setup(swaggerSpec, swaggerUiOptions)
    );
}

// Apply rate limiting to API routes
// Use both limiters: apiLimiter for unauthenticated, authenticatedApiLimiter for authenticated
// Each has skip logic to handle their specific use case
const registerRateLimiting = (basePath) => {
    app.use(basePath, apiLimiter);
    app.use(basePath, authenticatedApiLimiter);
};

const rateLimitPath =
    API_VERSION && API_BASE_PATH !== '/api' ? API_BASE_PATH : '/api';
registerRateLimiting(rateLimitPath);

// Health check (before auth middleware) - ensure it's completely bypassed
const registerHealthCheck = (basePath) => {
    app.get(`${basePath}/health`, (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.environment,
            trustProxy: config.trustProxy,
        });
    });
};

const healthPaths = new Set(['/api']);
if (API_VERSION && API_BASE_PATH !== '/api') {
    healthPaths.add(API_BASE_PATH);
}
healthPaths.forEach(registerHealthCheck);

const registerApiRoutes = (basePath) => {
    app.use(basePath, authModule.routes);
    app.use(basePath, featureFlagsModule.routes);
    app.use(`${basePath}/oidc`, oidcModule.routes);

    app.use(basePath, requireAuth);
    app.use(basePath, tasksModule.routes);
    app.use(basePath, habitsModule.routes);
    app.use(basePath, projectsModule.routes);
    app.use(basePath, adminModule.routes);
    app.use(basePath, sharesModule.routes);
    app.use(basePath, areasModule.routes);
    app.use(basePath, notesModule.routes);
    app.use(basePath, tagsModule.routes);
    app.use(basePath, usersModule.routes);
    app.use(basePath, inboxModule.routes);
    app.use(basePath, urlModule.routes);
    app.use(basePath, telegramModule.routes);
    app.use(basePath, quotesModule.routes);
    app.use(basePath, backupModule.routes);
    app.use(basePath, searchModule.routes);
    app.use(basePath, viewsModule.routes);
    app.use(basePath, notificationsModule.routes);
    app.use(basePath, mcpModule.routes);
};

// Register routes at both /api and /api/v1 (if versioned) to maintain backwards compatibility
// The requireAuth middleware is applied once per base path, preventing the auth loop
const routeBases = new Set(['/api']);
if (API_VERSION && API_BASE_PATH !== '/api') {
    routeBases.add(API_BASE_PATH);
}
routeBases.forEach(registerApiRoutes);

// SPA fallback
app.get('*', (req, res) => {
    if (
        !req.path.startsWith('/api/') &&
        !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)
    ) {
        if (config.production) {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        } else {
            res.sendFile(path.join(__dirname, '../public', 'index.html'));
        }
    } else {
        res.status(404).json({
            error: 'Not Found',
            message: 'The requested resource could not be found.',
        });
    }
});

// Error handling middleware (handles AppError and Sequelize errors)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
    try {
        // Create session store table
        await sessionStore.sync();

        // Initialize email service
        initializeEmailService();

        // Initialize Telegram polling after database is ready
        await initializeTelegramPolling();

        // Initialize task scheduler
        await taskScheduler.initialize();

        // Initialize CalDAV sync scheduler
        const caldavSyncScheduler = require('./modules/caldav/services/sync-scheduler');
        await caldavSyncScheduler.initialize();

        // Validate authentication configuration
        const { validateAuthConfiguration } = require('./config/authConfig');
        validateAuthConfiguration();

        const server = app.listen(config.port, config.host, () => {
            console.log(`Server running on port ${config.port}`);
            console.log(`Server listening on http://localhost:${config.port}`);
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
