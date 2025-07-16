require('dotenv').config();
const path = require('path');
const { setConfig, getConfig } = require('../config/config');
const config = getConfig();

module.exports = {
    development: {
        dialect: 'sqlite',
        storage: config.dbFile,
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
        storage: config.dbFile,
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
        storage: config.dbFile,
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
};
