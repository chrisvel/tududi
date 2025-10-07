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

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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

// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Tududi API',
            version: '1.0.0',
            description: 'API documentation for Tududi task management',
        },
        servers: [{ url: '/api' }],
    },
    apis: [path.join(__dirname, 'routes', '*.js')], // Path to API routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
app.use('/api/uploads', express.static(config.uploadPath));

// Authentication middleware
const { requireAuth } = require('./middleware/auth');
const { logError } = require('./services/logService');

// Health check (before auth middleware) - ensure it's completely bypassed
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.environment,
    });
});

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', requireAuth, require('./routes/tasks'));
app.use('/api', requireAuth, require('./routes/projects'));
app.use('/api', requireAuth, require('./routes/areas'));
app.use('/api', requireAuth, require('./routes/notes'));
app.use('/api', requireAuth, require('./routes/tags'));
app.use('/api', requireAuth, require('./routes/users'));
app.use('/api', requireAuth, require('./routes/inbox'));
app.use('/api', requireAuth, require('./routes/url'));
app.use('/api', requireAuth, require('./routes/telegram'));
app.use('/api', requireAuth, require('./routes/quotes'));
app.use('/api', requireAuth, require('./routes/task-events'));

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
