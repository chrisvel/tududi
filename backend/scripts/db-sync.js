#!/usr/bin/env node

/**
 * Database Sync Script
 * Syncs the database by creating tables if they don't exist (without dropping existing data)
 *
 * No npm script points at this directly (db:prepare supersedes it for that
 * use), but tests/upgrade/helpers/bootstrap.js shells out to it by path to
 * build a reference schema straight from the models with no migrations
 * applied - db:prepare always applies/records migrations, so it can't stand
 * in for that. Keep this file even if it looks unused from package.json.
 */

require('dotenv').config();
const { sequelize } = require('../models');

async function syncDatabase() {
    try {
        console.log('Syncing database...');

        await sequelize.sync();

        console.log('✅ Database synchronized successfully');
        console.log('All tables have been created (existing data preserved)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error syncing database:', error.message);
        process.exit(1);
    }
}

syncDatabase();
