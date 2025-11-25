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
const { initializeTelegramPolling } = require('./services/telegramInitializer');
const taskScheduler = require('./services/taskScheduler');
const { setConfig, getConfig } = require('./config/config');
const config = getConfig();
const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE_PATH = `/api/${API_VERSION}`;

const app = express();

// Session store
const sessionStore = new SequelizeStore({
    db: sequelize,
});

// Middlewares
app.use(
    helmet({
        hsts: false,
        forceHTTPS: false,
        contentSecurityPolicy: false,
    })
);
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(
    cors({
        origin: config.allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Authorization',
            'Content-Type',
            'Accept',
            'X-Requested-With',
        ],
        exposedHeaders: ['Content-Type'],
        maxAge: 1728000,
    })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(
    session({
        secret: config.secret,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 2592000000, // 30 days
            sameSite: 'lax',
        },
    })
);

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
        });
    });
};

const healthPaths = new Set(['/api']);
if (API_VERSION && API_BASE_PATH !== '/api') {
    healthPaths.add(API_BASE_PATH);
}
healthPaths.forEach(registerHealthCheck);

// Routes
const registerApiRoutes = (basePath) => {
    app.use(basePath, require('./routes/auth'));

    app.use(basePath, requireAuth);
    app.use(basePath, require('./routes/tasks'));
    app.use(basePath, require('./routes/projects'));
    app.use(basePath, require('./routes/admin'));
    app.use(basePath, require('./routes/shares'));
    app.use(basePath, require('./routes/areas'));
    app.use(basePath, require('./routes/notes'));
    app.use(basePath, require('./routes/tags'));
    app.use(basePath, require('./routes/users'));
    app.use(basePath, require('./routes/inbox'));
    app.use(basePath, require('./routes/url'));
    app.use(basePath, require('./routes/telegram'));
    app.use(basePath, require('./routes/quotes'));
    app.use(basePath, require('./routes/task-events'));
    app.use(`${basePath}/search`, require('./routes/search'));
    app.use(`${basePath}/views`, require('./routes/views'));
    app.use(`${basePath}/notifications`, require('./routes/notifications'));
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

// Error handling fallback.
// We shouldn't be here normally!
// Each route should properly handle
// and log its own errors.
app.use((err, req, res, next) => {
    logError(err);
    res.status(500).json({
        error: 'Internal Server Error',
        // message: err.message,
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Create session store table
        await sessionStore.sync();

        // Initialize Telegram polling after database is ready
        await initializeTelegramPolling();

        // Initialize task scheduler
        await taskScheduler.initialize();

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
