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

const app = express();

// Session store
const sessionStore = new SequelizeStore({
  db: sequelize,
});

// Middlewares
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = process.env.TUDUDI_ALLOWED_ORIGINS 
  ? process.env.TUDUDI_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:8080', 'http://localhost:9292', 'http://127.0.0.1:8080', 'http://127.0.0.1:9292'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  maxAge: 1728000
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
const secureFlag = process.env.NODE_ENV === 'production' && process.env.TUDUDI_INTERNAL_SSL_ENABLED === 'true';
app.use(session({
  secret: process.env.TUDUDI_SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: secureFlag,
    maxAge: 2592000000, // 30 days
    sameSite: secureFlag ? 'none' : 'lax'
  }
}));

// Static files
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
} else {
  app.use(express.static('public'));
}

// Serve locales 
if (process.env.NODE_ENV === 'production') {
  app.use('/locales', express.static(path.join(__dirname, 'dist/locales')));
} else {
  app.use('/locales', express.static(path.join(__dirname, '../public/locales')));
}

// Authentication middleware
const { requireAuth } = require('./middleware/auth');

// Health check (before auth middleware)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    if (process.env.NODE_ENV === 'production') {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  } else {
    res.status(404).json({ error: 'Not Found', message: 'The requested resource could not be found.' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 3002;

// Initialize database and start server
async function startServer() {
  try {
    // Create session store table
    await sessionStore.sync();
    
    // Sync database
    await sequelize.sync();
    
    // Auto-create user if not exists
    if (process.env.TUDUDI_USER_EMAIL && process.env.TUDUDI_USER_PASSWORD) {
      const { User } = require('./models');
      const bcrypt = require('bcrypt');
      
      const [user, created] = await User.findOrCreate({
        where: { email: process.env.TUDUDI_USER_EMAIL },
        defaults: {
          email: process.env.TUDUDI_USER_EMAIL,
          password: await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD, 10)
        }
      });
      
      if (created) {
        console.log('Default user created:', user.email);
      }
    }
    
    // Initialize Telegram polling after database is ready
    await initializeTelegramPolling();
    
    // Initialize task scheduler
    await taskScheduler.initialize();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server listening on http://localhost:${PORT}`);
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