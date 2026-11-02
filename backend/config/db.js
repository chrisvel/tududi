const { getConfig } = require('./config');

// Column naming and timestamp conventions shared by every model.
const DEFINE_OPTIONS = {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
};

// Builds the options object handed to `new Sequelize(options)`. Used by the
// application (models/index.js), by sequelize-cli (config/database.js) and by
// the standalone migration script so all three agree on the target database.
function buildSequelizeOptions({ logging } = {}) {
    const config = getConfig();
    const db = config.db;

    const resolvedLogging =
        logging !== undefined
            ? logging
            : config.environment === 'development'
              ? console.log
              : false;

    const dialectOptions = {};
    if (db.ssl) {
        dialectOptions.ssl = db.ssl;
    }

    return {
        dialect: 'postgres',
        host: db.host,
        port: db.port,
        database: db.database,
        username: db.username,
        password: db.password,
        logging: resolvedLogging,
        // Store and read every timestamp as UTC so date bucketing (DATE(),
        // day boundaries) does not depend on the server's timezone.
        timezone: '+00:00',
        dialectOptions,
        pool: {
            max: db.poolMax,
            min: 0,
            idle: 10000,
            acquire: 60000,
        },
        define: DEFINE_OPTIONS,
    };
}

module.exports = { buildSequelizeOptions, DEFINE_OPTIONS };
