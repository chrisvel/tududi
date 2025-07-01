#!/usr/bin/env node

/**
 * Database Sync Script
 * Syncs the database by creating tables if they don't exist (without dropping existing data)
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
