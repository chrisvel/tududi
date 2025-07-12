require('dotenv').config();
const path = require('path');
const config = require('./config');

module.exports = {
    development: {
        dialect: 'sqlite',
        storage: path.join(config.dbDir, 'development.sqlite3'),
        logging: console.log,
        define: {
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    test: {
        dialect: 'sqlite',
        storage: path.join(config.dbDir, 'test.sqlite3'),
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    production: {
        dialect: 'sqlite',
        storage: path.join(config.dbDir, 'production.sqlite3'),
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
};
